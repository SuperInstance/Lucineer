/**
 * ClawStudio Simulation Runner
 *
 * Orchestrates one-click simulation from VS Code:
 * 1. Auto-detect simulator (Verilator → Icarus → Vivado XSIM)
 * 2. Resolve file dependencies (import/include tracing)
 * 3. Compile and run testbench
 * 4. Parse results and display in panel
 * 5. Open waveform viewer on completion
 */

import * as vscode from "vscode";
import * as path from "path";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type SimulatorType = "verilator" | "icarus" | "vivado";

export interface SimulationResult {
  simulator: SimulatorType;
  testbench: string;
  passed: boolean;
  checksPassed: number;
  checksFailed: number;
  duration: number; // milliseconds
  coverage: number | null; // toggle coverage percentage
  waveformPath: string | null;
  stdout: string;
  stderr: string;
}

interface SimulatorConfig {
  type: SimulatorType;
  path: string;
  version: string;
}

/**
 * Detect available simulators in order of preference.
 */
export async function detectSimulator(): Promise<SimulatorConfig | null> {
  const simulators: Array<{ type: SimulatorType; cmd: string; versionFlag: string }> = [
    { type: "verilator", cmd: "verilator", versionFlag: "--version" },
    { type: "icarus", cmd: "iverilog", versionFlag: "-V" },
    { type: "vivado", cmd: "xvlog", versionFlag: "--version" },
  ];

  // Check user preference first
  const preferred = vscode.workspace
    .getConfiguration("clawstudio")
    .get<string>("simulator");

  if (preferred) {
    const pref = simulators.find((s) => s.type === preferred);
    if (pref) {
      simulators.unshift(simulators.splice(simulators.indexOf(pref), 1)[0]);
    }
  }

  for (const sim of simulators) {
    try {
      const { stdout } = await execAsync(`${sim.cmd} ${sim.versionFlag} 2>&1`);
      const version = stdout.trim().split("\n")[0];
      const whichResult = await execAsync(`which ${sim.cmd}`);
      return {
        type: sim.type,
        path: whichResult.stdout.trim(),
        version,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Resolve all source file dependencies for a testbench.
 * Traces `import`, `include`, and module instantiations.
 */
export async function resolveDependencies(
  testbenchPath: string,
  workspaceRoot: string
): Promise<string[]> {
  const files = new Set<string>();
  const visited = new Set<string>();
  const searchPaths = [
    path.dirname(testbenchPath),
    path.join(workspaceRoot, "reference", "common"),
    path.join(workspaceRoot, "download", "ternaryair", "hardware", "rtl"),
  ];

  async function trace(filePath: string): Promise<void> {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(filePath);
      const content = doc.getText();
      files.add(filePath);

      // Find `include directives
      const includeRegex = /`include\s+"([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = includeRegex.exec(content)) !== null) {
        const includeName = match[1];
        for (const searchDir of searchPaths) {
          const includePath = path.join(searchDir, includeName);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(includePath));
            await trace(includePath);
            break;
          } catch {
            continue;
          }
        }
      }

      // Find import package references
      const importRegex = /import\s+(\w+)::/g;
      while ((match = importRegex.exec(content)) !== null) {
        const pkgName = match[1];
        for (const searchDir of searchPaths) {
          const pkgPath = path.join(searchDir, `${pkgName}.sv`);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(pkgPath));
            await trace(pkgPath);
            break;
          } catch {
            continue;
          }
        }
      }
    } catch {
      // File not found — skip
    }
  }

  await trace(testbenchPath);
  return Array.from(files);
}

/**
 * Build simulator command line.
 */
function buildCommand(
  simulator: SimulatorConfig,
  sources: string[],
  topModule: string,
  outputDir: string
): string[] {
  const waveFile = path.join(outputDir, `${topModule}.vcd`);

  switch (simulator.type) {
    case "verilator":
      return [
        "verilator",
        "--binary",
        "--timing",
        "--trace",
        "-Wall",
        "-Wno-DECLFILENAME",
        "--top-module", topModule,
        "-o", path.join(outputDir, topModule),
        ...sources,
      ];

    case "icarus":
      return [
        "iverilog",
        "-g2012",
        "-o", path.join(outputDir, `${topModule}.vvp`),
        "-s", topModule,
        ...sources,
      ];

    case "vivado":
      return [
        "xvlog",
        "--sv",
        ...sources,
      ];

    default:
      throw new Error(`Unknown simulator: ${simulator.type}`);
  }
}

/**
 * Parse simulation output for pass/fail counts.
 */
function parseResults(stdout: string, stderr: string): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  // Match common testbench output patterns
  const passPatterns = [/PASS/gi, /\bOK\b/g, /✓/g, /PASSED/gi];
  const failPatterns = [/FAIL/gi, /ERROR/gi, /✗/g, /FAILED/gi];

  const combined = stdout + "\n" + stderr;

  for (const pattern of passPatterns) {
    const matches = combined.match(pattern);
    if (matches) passed += matches.length;
  }

  for (const pattern of failPatterns) {
    const matches = combined.match(pattern);
    if (matches) failed += matches.length;
  }

  // Check for explicit results line: "Results: N passed, M failed"
  const resultsMatch = combined.match(/(\d+)\s*passed.*?(\d+)\s*failed/i);
  if (resultsMatch) {
    passed = parseInt(resultsMatch[1], 10);
    failed = parseInt(resultsMatch[2], 10);
  }

  return { passed, failed };
}

/**
 * Infer top module name from testbench file.
 */
function inferTopModule(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  // tb_foo.sv → tb_foo, foo_tb.sv → foo_tb
  return basename;
}

/**
 * Run a simulation and return results.
 */
export async function runSimulation(
  testbenchPath: string,
  workspaceRoot: string,
  outputChannel: vscode.OutputChannel
): Promise<SimulationResult> {
  const startTime = Date.now();

  // Step 1: Detect simulator
  outputChannel.appendLine("Detecting simulator...");
  const simulator = await detectSimulator();
  if (!simulator) {
    throw new Error(
      "No simulator found. Install Verilator, Icarus Verilog, or Vivado."
    );
  }
  outputChannel.appendLine(`Using ${simulator.type} (${simulator.version})`);

  // Step 2: Resolve dependencies
  outputChannel.appendLine("Resolving file dependencies...");
  const sources = await resolveDependencies(testbenchPath, workspaceRoot);
  outputChannel.appendLine(`Found ${sources.length} source files`);

  // Step 3: Build and run
  const topModule = inferTopModule(testbenchPath);
  const outputDir = path.join(workspaceRoot, ".clawstudio", "sim");
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(outputDir));

  const cmd = buildCommand(simulator, sources, topModule, outputDir);
  outputChannel.appendLine(`> ${cmd.join(" ")}`);

  try {
    // Compile
    const { stdout: compileOut, stderr: compileErr } = await execAsync(
      cmd.join(" "),
      { cwd: workspaceRoot, timeout: 120_000 }
    );
    outputChannel.appendLine(compileOut);
    if (compileErr) outputChannel.appendLine(compileErr);

    // Run (for Verilator and Icarus, separate step)
    let runOut = "";
    let runErr = "";
    if (simulator.type === "verilator") {
      const result = await execAsync(
        path.join(outputDir, topModule),
        { cwd: outputDir, timeout: 60_000 }
      );
      runOut = result.stdout;
      runErr = result.stderr;
    } else if (simulator.type === "icarus") {
      const result = await execAsync(
        `vvp ${path.join(outputDir, `${topModule}.vvp`)}`,
        { cwd: outputDir, timeout: 60_000 }
      );
      runOut = result.stdout;
      runErr = result.stderr;
    }

    outputChannel.appendLine(runOut);
    if (runErr) outputChannel.appendLine(runErr);

    const { passed, failed } = parseResults(
      compileOut + runOut,
      compileErr + runErr
    );

    const waveformPath = path.join(outputDir, `${topModule}.vcd`);
    let waveExists = false;
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(waveformPath));
      waveExists = true;
    } catch {
      // No waveform generated
    }

    return {
      simulator: simulator.type,
      testbench: testbenchPath,
      passed: failed === 0,
      checksPassed: passed,
      checksFailed: failed,
      duration: Date.now() - startTime,
      coverage: null, // TODO: parse coverage report
      waveformPath: waveExists ? waveformPath : null,
      stdout: compileOut + runOut,
      stderr: compileErr + runErr,
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const { passed, failed } = parseResults(
      err.stdout ?? "",
      err.stderr ?? ""
    );

    return {
      simulator: simulator.type,
      testbench: testbenchPath,
      passed: false,
      checksPassed: passed,
      checksFailed: failed > 0 ? failed : 1,
      duration: Date.now() - startTime,
      coverage: null,
      waveformPath: null,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "Unknown error",
    };
  }
}
