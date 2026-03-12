#!/usr/bin/env python3
"""
Master Orchestration Runner
Launches all specialized DeepSeek agents in parallel for maximum API utilization

Target: 1500-2500 DeepSeek API calls with evidence-based quality tracking
"""

import os
import sys
import json
import asyncio
import aiohttp
from datetime import datetime
from typing import Dict, List, Any
import statistics
import threading
import time

# Global tracking
api_stats = {
    "deepseek_calls": 0,
    "deepseek_tokens": 0,
    "deepseek_cost": 0.0,
    "glm5_calls": 0,
    "start_time": None,
    "lock": threading.Lock()
}

DEEPSEEK_API_KEY = "sk-2c32887fc62b4016b6ff03f982968b76"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1/chat/completions"
GLM5_BASE_URL = "http://localhost:3000/api/chat"

# All 12 specialized domains
DOMAINS = {
    "thermal_physics": {
        "focus": "Heat dissipation, thermal modeling, cooling solutions",
        "tasks": [
            "Calculate thermal resistance network for 32x32 PE array at 1GHz",
            "Simulate transient thermal response under full-load conditions",
            "Analyze hotspot formation in accumulator regions",
            "Optimize thermal via placement for heat spreading",
            "Calculate required heatsink thermal resistance",
            "Simulate power cycling thermal stress analysis",
            "Analyze thermal coupling between adjacent PEs",
            "Calculate optimal die attach material properties",
            "Simulate package-level thermal performance",
            "Analyze cooling solution effectiveness for 5W TDP"
        ],
        "baselines": {"junction_temp_c": 85, "thermal_resistance_cw": 0.5, "power_density_wmm2": 0.3}
    },
    "vlsi_layout": {
        "focus": "Floorplanning, routing, area optimization, placement",
        "tasks": [
            "Generate optimized floorplan for 32x32 PE array",
            "Calculate routing congestion analysis",
            "Optimize power grid placement for IR drop minimization",
            "Design clock tree distribution network",
            "Calculate minimum wirelength placement",
            "Analyze area breakdown by module",
            "Optimize pad placement for signal integrity",
            "Design hierarchical boundary cells",
            "Calculate utilization density targets",
            "Analyze aspect ratio for optimal routing"
        ],
        "baselines": {"area_mm2": 25, "routing_congestion": 0.7, "wirelength_mm": 150}
    },
    "power_analysis": {
        "focus": "Dynamic/static power, IR drop, power gating",
        "tasks": [
            "Calculate dynamic power for 32x32 PE array during matrix multiplication",
            "Analyze IR drop across power grid for worst-case switching",
            "Estimate leakage power at 85C junction temperature",
            "Design power gating strategy for idle PE clusters",
            "Calculate clock tree power consumption",
            "Analyze power-rail decoupling capacitor requirements",
            "Estimate power consumption during inference workload",
            "Calculate short-circuit power in CMOS gates",
            "Analyze power state transitions and energy overhead",
            "Design adaptive voltage scaling strategy"
        ],
        "baselines": {"total_power_w": 5.0, "dynamic_power_w": 3.5, "leakage_power_w": 1.5, "ir_drop_mv": 50}
    },
    "timing_closure": {
        "focus": "STA, clock tree synthesis, timing optimization",
        "tasks": [
            "Run static timing analysis for critical path",
            "Calculate setup and hold margins at all corners",
            "Optimize clock tree for minimal skew",
            "Analyze timing paths through PE array",
            "Calculate clock latency distribution",
            "Design clock gating cells for power reduction",
            "Analyze on-chip variation effects",
            "Calculate timing slack distribution",
            "Optimize buffer insertion for timing",
            "Analyze multi-cycle path opportunities"
        ],
        "baselines": {"setup_slack_ps": 100, "hold_slack_ps": 50, "clock_skew_ps": 20}
    },
    "memory_architecture": {
        "focus": "SRAM design, cache hierarchy, memory bandwidth",
        "tasks": [
            "Design 256KB SRAM array with timing optimization",
            "Calculate memory bandwidth for transformer attention",
            "Optimize cache line size for inference workload",
            "Design weight ROM interface for mask-locked storage",
            "Calculate KV-cache size requirements",
            "Analyze memory access patterns",
            "Design arbitration for multi-port access",
            "Calculate SRAM leakage and retention power",
            "Optimize sense amplifier design",
            "Analyze memory bottleneck analysis"
        ],
        "baselines": {"sram_size_kb": 256, "bandwidth_gbps": 128, "latency_cycles": 3, "hit_rate": 0.95}
    },
    "neuromorphic_computing": {
        "focus": "Spike-based computing, synaptic plasticity, event-driven",
        "tasks": [
            "Design spike-based accumulation circuit",
            "Simulate synaptic weight update mechanisms",
            "Analyze spike timing dependent plasticity",
            "Design event-driven state machine",
            "Calculate energy per spike event",
            "Analyze sparsity benefits for power",
            "Design integrate-and-fire circuit",
            "Simulate spike rate encoding schemes",
            "Analyze membrane potential dynamics",
            "Calculate synaptic density limits"
        ],
        "baselines": {"spike_rate_hz": 1000, "synaptic_density": 1e6, "energy_per_spike_pj": 10}
    },
    "verification": {
        "focus": "Testbenches, coverage, formal methods, assertion-based",
        "tasks": [
            "Generate SystemVerilog testbench for PE array",
            "Calculate functional coverage metrics",
            "Design assertion-based checking",
            "Analyze corner case scenarios",
            "Generate constrained random tests",
            "Design formal verification properties",
            "Calculate code coverage targets",
            "Analyze protocol compliance checking",
            "Design regression test suite",
            "Calculate bug detection effectiveness"
        ],
        "baselines": {"code_coverage_pct": 95, "functional_coverage_pct": 90}
    },
    "reliability": {
        "focus": "Aging, ESD, soft errors, MTBF analysis",
        "tasks": [
            "Calculate MTBF for 5-year product lifetime",
            "Analyze NBTI aging effects on PMOS",
            "Simulate soft error rate from cosmic rays",
            "Design ESD protection circuits",
            "Analyze electromigration in power rails",
            "Calculate TDDB lifetime estimation",
            "Design guard bands for aging",
            "Analyze hot carrier injection effects",
            "Calculate FIT rate for memory array",
            "Design redundant circuits for yield improvement"
        ],
        "baselines": {"mtbf_hours": 100000, "esd_threshold_v": 2000, "soft_error_rate": 1e-12}
    },
    "signal_integrity": {
        "focus": "Crosstalk, EM analysis, SSO, power integrity",
        "tasks": [
            "Analyze crosstalk in dense routing channels",
            "Simulate simultaneous switching output noise",
            "Calculate power delivery network impedance",
            "Analyze electromagnetic interference",
            "Design decoupling capacitor placement",
            "Calculate transmission line effects",
            "Analyze supply noise impact on timing",
            "Design guard band for signal integrity",
            "Calculate SSO ground bounce",
            "Analyze clock jitter from supply noise"
        ],
        "baselines": {"crosstalk_mv": 50, "em_violations": 0, "sso_noise_mv": 100}
    },
    "process_variation": {
        "focus": "PVT corners, statistical design, Monte Carlo",
        "tasks": [
            "Run Monte Carlo simulation for timing",
            "Analyze PVT corner coverage",
            "Calculate yield at 3-sigma",
            "Design guard bands for variation",
            "Analyze mismatch between PEs",
            "Calculate statistical power distribution",
            "Design calibration circuits for variation",
            "Analyze temperature sensitivity",
            "Calculate voltage sensitivity coefficients",
            "Design adaptive body bias scheme"
        ],
        "baselines": {"yield_pct": 99.5, "sigma_variation": 0.1, "pvt_coverage": 100}
    },
    "system_integration": {
        "focus": "NoC design, interconnects, protocols, arbitration",
        "tasks": [
            "Design mesh NoC topology for PE array",
            "Simulate arbitration fairness",
            "Calculate network bandwidth utilization",
            "Analyze deadlock prevention",
            "Design flow control mechanism",
            "Calculate average packet latency",
            "Analyze buffer size requirements",
            "Design virtual channel allocation",
            "Calculate throughput under load",
            "Analyze protocol compliance"
        ],
        "baselines": {"noc_latency_cycles": 10, "bandwidth_utilization_pct": 80, "packet_loss_rate": 0}
    },
    "ml_hardware": {
        "focus": "Quantization, pruning hardware, accelerator design",
        "tasks": [
            "Design ternary weight quantizer with {-1, 0, +1} encoding",
            "Implement sparse matrix multiplication accelerator",
            "Analyze quantization error propagation through network layers",
            "Design efficient weight storage for mask-locked ROM",
            "Calculate inference throughput for transformer attention layers",
            "Design KV-cache compression hardware",
            "Implement hardware-friendly activation quantization",
            "Analyze memory bandwidth requirements for attention",
            "Design efficient softmax approximation hardware",
            "Calculate TOPS/W for inference workload"
        ],
        "baselines": {"quantization_error": 0.01, "inference_latency_us": 100, "accuracy_loss_pct": 1.0}
    }
}


class SpecializedDomainAgent:
    """Specialized agent for a single domain"""
    
    def __init__(self, domain: str, config: Dict, session: aiohttp.ClientSession):
        self.domain = domain
        self.config = config
        self.session = session
        self.calls_made = 0
        self.results = []
        self.expertise = config["focus"]
        self.tasks = config["tasks"]
        self.baselines = config["baselines"]
    
    async def call_deepseek(self, prompt: str, max_tokens: int = 4096) -> tuple:
        """Execute DeepSeek API call"""
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        system_prompt = f"""You are a specialized {self.expertise} engineer for ASIC design.
        Provide precise, technical, and actionable responses with numerical results.
        
        Output format (JSON):
        {{
            "metric_name": numerical_value,
            "analysis": "brief analysis text",
            "recommendations": ["rec1", "rec2"]
        }}
        
        Context: 28nm technology, 5W power budget, 1GHz, 25mm² die
        """
        
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7
        }
        
        try:
            async with self.session.post(DEEPSEEK_BASE_URL, headers=headers, json=payload, timeout=90) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    tokens = data.get("usage", {}).get("total_tokens", 0)
                    
                    with api_stats["lock"]:
                        api_stats["deepseek_calls"] += 1
                        api_stats["deepseek_tokens"] += tokens
                        api_stats["deepseek_cost"] += tokens * 0.0002 / 1000
                    
                    self.calls_made += 1
                    return content, tokens
                else:
                    return f"Error: {resp.status}", 0
        except Exception as e:
            return f"Exception: {str(e)}", 0
    
    async def run_simulations(self, num_simulations: int = 80) -> List[Dict]:
        """Run multiple simulations for this domain"""
        
        for i in range(num_simulations):
            task_idx = i % len(self.tasks)
            task = self.tasks[task_idx]
            
            prompt = f"""
            DOMAIN: {self.domain}
            TASK: {task}
            CYCLE: {i+1}/{num_simulations}
            
            Provide detailed analysis with numerical metrics.
            Focus on mask-locked inference chip design context.
            
            Output metrics in JSON format matching baseline keys:
            {json.dumps(self.baselines, indent=2)}
            """
            
            result, tokens = await self.call_deepseek(prompt)
            
            # Parse metrics
            metrics = self._extract_metrics(result)
            
            # Calculate quality score
            quality = self._calculate_quality(metrics)
            
            self.results.append({
                "cycle": i,
                "task": task,
                "metrics": metrics,
                "quality_score": quality,
                "is_signal": quality > 0.4,
                "raw_result": result[:1000]
            })
            
            # Progress report
            if (i + 1) % 20 == 0:
                avg_q = statistics.mean([r["quality_score"] for r in self.results])
                print(f"[{self.domain}] {i+1}/{num_simulations} done, avg quality: {avg_q:.2f}")
            
            # Rate limiting
            await asyncio.sleep(0.15)
        
        return self.results
    
    def _extract_metrics(self, result: str) -> Dict:
        """Extract numerical metrics from result"""
        import re
        metrics = {}
        
        # Try JSON extraction
        json_pattern = r'\{[^{}]*\}'
        for match in re.finditer(json_pattern, result, re.DOTALL):
            try:
                parsed = json.loads(match.group())
                for k, v in parsed.items():
                    if isinstance(v, (int, float)):
                        metrics[k] = float(v)
            except:
                pass
        
        # Pattern matching for baseline keys
        for key in self.baselines.keys():
            patterns = [
                rf"{key}[\s:]+([0-9.]+)",
                rf'"{key}"[\s:]+([0-9.]+)',
            ]
            for pattern in patterns:
                match = re.search(pattern, result, re.IGNORECASE)
                if match:
                    try:
                        metrics[key] = float(match.group(1))
                        break
                    except:
                        pass
        
        return metrics
    
    def _calculate_quality(self, metrics: Dict) -> float:
        """Calculate quality score"""
        if not metrics:
            return 0.5
        
        scores = []
        for key, baseline in self.baselines.items():
            if key in metrics:
                actual = metrics[key]
                # Handle zero baseline case
                if baseline == 0:
                    # For zero baseline, perfect if actual is 0, otherwise penalize
                    scores.append(1.0 if actual == 0 else max(0, 1 - actual * 0.1))
                elif actual <= baseline:
                    scores.append(1.0)
                else:
                    scores.append(max(0, 1 - (actual - baseline) / baseline))
        
        return statistics.mean(scores) if scores else 0.5
    
    def get_summary(self) -> Dict:
        """Get summary statistics"""
        if not self.results:
            return {}
        
        qualities = [r["quality_score"] for r in self.results]
        signals = sum(1 for r in self.results if r["is_signal"])
        
        all_metrics = {}
        for r in self.results:
            for k, v in r["metrics"].items():
                if k not in all_metrics:
                    all_metrics[k] = []
                all_metrics[k].append(v)
        
        return {
            "domain": self.domain,
            "total_calls": self.calls_made,
            "avg_quality": statistics.mean(qualities),
            "signal_ratio": signals / len(self.results),
            "metrics_summary": {
                k: {"mean": statistics.mean(v), "min": min(v), "max": max(v), "count": len(v)}
                for k, v in all_metrics.items() if v
            }
        }


async def run_all_domains_parallel(num_per_domain: int = 80):
    """Run all domain agents in parallel"""
    
    print(f"\n{'='*70}")
    print(f"MASTER ORCHESTRATION: Running {len(DOMAINS)} domain agents in parallel")
    print(f"Target: ~{len(DOMAINS) * num_per_domain} DeepSeek API calls")
    print(f"{'='*70}\n")
    
    api_stats["start_time"] = datetime.now()
    
    async with aiohttp.ClientSession() as session:
        # Create all agents
        agents = {
            domain: SpecializedDomainAgent(domain, config, session)
            for domain, config in DOMAINS.items()
        }
        
        # Run all in parallel
        tasks = [agent.run_simulations(num_per_domain) for agent in agents.values()]
        await asyncio.gather(*tasks)
        
        # Collect results
        all_summaries = {}
        for domain, agent in agents.items():
            all_summaries[domain] = agent.get_summary()
        
        return all_summaries


async def main():
    """Main entry point"""
    
    # Run all domain simulations in parallel
    summaries = await run_all_domains_parallel(num_per_domain=80)
    
    # Calculate overall statistics
    total_calls = sum(s["total_calls"] for s in summaries.values())
    avg_quality = statistics.mean([s["avg_quality"] for s in summaries.values()])
    signal_ratio = statistics.mean([s["signal_ratio"] for s in summaries.values()])
    
    runtime = (datetime.now() - api_stats["start_time"]).total_seconds() if api_stats["start_time"] else 0
    
    # Final report
    report = {
        "orchestration_summary": {
            "total_deepseek_calls": api_stats["deepseek_calls"],
            "total_deepseek_tokens": api_stats["deepseek_tokens"],
            "deepseek_cost_usd": api_stats["deepseek_cost"],
            "runtime_seconds": runtime,
            "average_quality": avg_quality,
            "signal_to_noise_ratio": signal_ratio,
            "calls_per_second": api_stats["deepseek_calls"] / runtime if runtime > 0 else 0
        },
        "domain_summaries": summaries,
        "timestamp": datetime.now().isoformat()
    }
    
    # Save report
    output_dir = "/home/z/my-project/research/deepseek_orchestration"
    os.makedirs(output_dir, exist_ok=True)
    
    report_path = f"{output_dir}/master_orchestration_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    # Print summary
    print(f"\n{'='*70}")
    print(f"ORCHESTRATION COMPLETE")
    print(f"{'='*70}")
    print(f"Total DeepSeek calls: {api_stats['deepseek_calls']}")
    print(f"Total tokens: {api_stats['deepseek_tokens']:,}")
    print(f"Cost: ${api_stats['deepseek_cost']:.4f}")
    print(f"Runtime: {runtime:.1f} seconds")
    print(f"Average quality: {avg_quality:.2f}")
    print(f"Signal ratio: {signal_ratio*100:.1f}%")
    print(f"Report saved: {report_path}")
    
    return report


if __name__ == "__main__":
    asyncio.run(main())
