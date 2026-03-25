/**
 * ClawStudio Cloud Synthesis Client
 *
 * Connects to Compile Cloud (tools/cloud/compile_cloud) for remote
 * synthesis when local Vivado is not available. Also supports direct
 * local FPGA programming via USB/JTAG.
 */

import * as vscode from "vscode";

export type SynthTarget = "kv260" | "genesys2" | "aws-f1" | "sky130" | "gf180";
export type SynthStatus = "queued" | "compiling" | "synthesizing" | "routing" | "bitgen" | "done" | "failed";

export interface SynthRequest {
  sources: string[];
  topModule: string;
  target: SynthTarget;
  constraints?: string;
  clockMhz?: number;
  macArraySize?: string; // e.g., "32x32"
}

export interface SynthJob {
  jobId: string;
  status: SynthStatus;
  progress: number; // 0-100
  startedAt: string;
  estimatedCompletion?: string;
  result?: SynthResult;
  error?: string;
}

export interface SynthResult {
  bitstreamUrl?: string;
  gdsiiUrl?: string;
  utilizationReport: UtilizationReport;
  timingReport: TimingReport;
  powerEstimate: PowerEstimate;
  artifacts: string[]; // downloadable file URLs
}

export interface UtilizationReport {
  luts: { used: number; available: number; percent: number };
  ffs: { used: number; available: number; percent: number };
  bram: { used: number; available: number; percent: number };
  dsp: { used: number; available: number; percent: number };
  io: { used: number; available: number; percent: number };
}

export interface TimingReport {
  targetMhz: number;
  achievedMhz: number;
  worstSlackNs: number;
  timingMet: boolean;
  criticalPathStart: string;
  criticalPathEnd: string;
  criticalPathStages: number;
}

export interface PowerEstimate {
  dynamicW: number;
  staticW: number;
  totalW: number;
  breakdownByModule: Record<string, number>;
}

/**
 * Client for the Compile Cloud REST API.
 */
export class CompileCloudClient {
  private apiKey: string;
  private endpoint: string;

  constructor() {
    const config = vscode.workspace.getConfiguration("clawstudio");
    this.apiKey = config.get<string>("cloudApiKey") ?? "";
    this.endpoint = config.get<string>("cloudEndpoint") ?? "https://api.clawcloud.dev";
  }

  /**
   * Submit a compilation job.
   */
  async submitJob(request: SynthRequest): Promise<SynthJob> {
    if (!this.apiKey) {
      throw new Error(
        "Cloud API key not configured. Set clawstudio.cloudApiKey in settings."
      );
    }

    const formData = new FormData();
    formData.append("top_module", request.topModule);
    formData.append("target", request.target);
    if (request.clockMhz) formData.append("clock_mhz", request.clockMhz.toString());
    if (request.macArraySize) formData.append("mac_array_size", request.macArraySize);

    // Attach source files
    for (const sourcePath of request.sources) {
      const content = await vscode.workspace.fs.readFile(vscode.Uri.file(sourcePath));
      const blob = new Blob([content], { type: "text/plain" });
      const fileName = sourcePath.split("/").pop() ?? "source.sv";
      formData.append("sources", blob, fileName);
    }

    if (request.constraints) {
      const content = await vscode.workspace.fs.readFile(
        vscode.Uri.file(request.constraints)
      );
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("constraints", blob, "constraints.xdc");
    }

    const response = await fetch(`${this.endpoint}/v1/compile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Compile Cloud error: ${error.detail ?? response.statusText}`);
    }

    return response.json() as Promise<SynthJob>;
  }

  /**
   * Poll job status.
   */
  async getJobStatus(jobId: string): Promise<SynthJob> {
    const response = await fetch(`${this.endpoint}/v1/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    return response.json() as Promise<SynthJob>;
  }

  /**
   * Download an artifact from a completed job.
   */
  async downloadArtifact(url: string, localPath: string): Promise<void> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download artifact: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(localPath),
      new Uint8Array(buffer)
    );
  }

  /**
   * Get account usage and quota.
   */
  async getUsage(): Promise<{
    compilesToday: number;
    dailyLimit: number;
    tier: string;
    parametersCompiled: number;
  }> {
    const response = await fetch(`${this.endpoint}/v1/usage`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get usage: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Run synthesis with progress reporting in VS Code.
 */
export async function synthesizeWithProgress(
  request: SynthRequest,
  outputChannel: vscode.OutputChannel
): Promise<SynthResult> {
  const client = new CompileCloudClient();

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Synthesizing ${request.topModule} for ${request.target}`,
      cancellable: true,
    },
    async (progress, token) => {
      // Submit job
      outputChannel.appendLine(`Submitting to Compile Cloud (target: ${request.target})...`);
      const job = await client.submitJob(request);
      outputChannel.appendLine(`Job ${job.jobId} created`);

      // Poll for completion
      const statusMessages: Record<SynthStatus, string> = {
        queued: "Waiting in queue...",
        compiling: "Compiling SystemVerilog...",
        synthesizing: "Running synthesis...",
        routing: "Place and route...",
        bitgen: "Generating bitstream...",
        done: "Complete!",
        failed: "Failed",
      };

      let lastStatus: SynthStatus = "queued";

      while (true) {
        if (token.isCancellationRequested) {
          throw new Error("Synthesis cancelled by user");
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));

        const status = await client.getJobStatus(job.jobId);

        if (status.status !== lastStatus) {
          lastStatus = status.status;
          const msg = statusMessages[status.status] ?? status.status;
          progress.report({ message: msg, increment: status.progress - (job.progress ?? 0) });
          outputChannel.appendLine(`[${status.status}] ${msg} (${status.progress}%)`);
        }

        if (status.status === "done" && status.result) {
          outputChannel.appendLine("\nSynthesis complete!");
          outputChannel.appendLine(
            `  LUTs: ${status.result.utilizationReport.luts.used}/${status.result.utilizationReport.luts.available} (${status.result.utilizationReport.luts.percent}%)`
          );
          outputChannel.appendLine(
            `  DSP:  ${status.result.utilizationReport.dsp.used}/${status.result.utilizationReport.dsp.available} (${status.result.utilizationReport.dsp.percent}%)`
          );
          outputChannel.appendLine(
            `  Timing: ${status.result.timingReport.timingMet ? "MET" : "VIOLATED"} (${status.result.timingReport.achievedMhz} MHz)`
          );
          outputChannel.appendLine(
            `  Power: ${status.result.powerEstimate.totalW.toFixed(2)} W`
          );
          return status.result;
        }

        if (status.status === "failed") {
          throw new Error(`Synthesis failed: ${status.error ?? "Unknown error"}`);
        }
      }
    }
  );
}
