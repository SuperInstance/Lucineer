#!/usr/bin/env python3
"""
ML Hardware Simulation Runner - 80+ DeepSeek API Calls
Specialized for mask-locked inference chip accelerator design

Accelerator Parameters:
- 32x32 systolic array (1024 PEs)
- Ternary weights: {-1, 0, +1} encoded in 2 bits
- 8-bit activations
- 1GHz clock, 256KB SRAM
- 128GB/s memory bandwidth
- Target: Transformer inference (2048 seq, 768 hidden, 12 heads)
"""

import os
import sys
import json
import time
import asyncio
import aiohttp
import statistics
import re
import random
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum

# API Configuration
DEEPSEEK_API_KEY = "sk-2c32887fc62b4016b6ff03f982968b76"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1/chat/completions"

# Quality baselines
QUALITY_BASELINES = {
    "quantization_error": 0.01,
    "inference_latency_us": 100,
    "accuracy_loss_pct": 1.0,
    "throughput_tops": 50
}

# Accelerator parameters
ACCELERATOR_CONFIG = """
ACCELERATOR SPECIFICATIONS:
- Architecture: 32x32 systolic array (1024 Processing Elements)
- Weight Encoding: Ternary {-1, 0, +1} in 2 bits
- Activation Precision: 8-bit signed integers
- Clock Frequency: 1GHz
- On-chip SRAM: 256KB
- Memory Bandwidth: 128GB/s
- Technology Node: 28nm CMOS
- Power Budget: 5W

TARGET WORKLOAD - Transformer Inference:
- Sequence Length: 2048 tokens
- Hidden Dimension: 768
- Attention Heads: 12
- Feed-forward Dimension: 3072
- Number of Layers: 12
- Batch Size: 1 (single stream inference)
"""

@dataclass
class SimulationResult:
    sim_id: int
    task_category: str
    task_variation: str
    prompt_sent: str
    raw_response: str
    metrics: Dict[str, float]
    quality_score: float
    signal_detected: bool
    timestamp: str
    tokens_used: int
    response_time_ms: float

class MLHardwareSimulator:
    def __init__(self):
        self.results: List[SimulationResult] = []
        self.api_calls = 0
        self.total_tokens = 0
        self.session = None
        self.start_time = None
        
        # Define 10 task categories with 8+ variations each
        self.simulation_tasks = self._define_simulation_tasks()
        
    def _define_simulation_tasks(self) -> Dict[str, List[str]]:
        """Define 80+ simulation task variations across 10 categories"""
        return {
            "1_ternary_weight_quantizer": [
                "Design a hardware-friendly ternary weight quantizer with symmetric thresholds. Calculate quantization error for FP32 to ternary conversion.",
                "Implement learned threshold ternary quantization. Analyze gradient-based threshold optimization for {-1, 0, +1} encoding.",
                "Design a ternary quantizer with per-channel scaling factors. Calculate expected quantization error across transformer layers.",
                "Implement approximate ternary quantization with hardware-efficient rounding. Evaluate quantization_error metric.",
                "Design a dynamic ternary quantizer that adapts thresholds per layer. Estimate accuracy_loss_pct for transformer models.",
                "Create a sparse-aware ternary quantizer exploiting weight distribution. Calculate compression ratio and quantization_error.",
                "Design a two-stage quantizer: FP32->INT8->Ternary. Analyze cumulative quantization_error propagation.",
                "Implement a ternary quantizer with error feedback mechanism. Evaluate residual quantization_error.",
                "Design hardware-efficient ternary quantization with 2-bit encoding. Calculate throughput_tops for weight loading."
            ],
            "2_sparse_matmul_accelerator": [
                "Design a sparse matrix multiplication unit for ternary weights. Calculate effective throughput_tops considering sparsity.",
                "Implement a compressed sparse row (CSR) format accelerator for ternary matrices. Analyze memory bandwidth utilization.",
                "Design a systolic array optimized for sparse ternary weights. Calculate inference_latency_us for attention layers.",
                "Implement zero-skipping logic in the MAC array. Estimate performance improvement and throughput_tops.",
                "Design an index-based sparse accelerator for structured pruning. Calculate accuracy_loss_pct vs throughput tradeoff.",
                "Create a hybrid dense-sparse accelerator architecture. Analyze inference_latency_us for mixed sparsity patterns.",
                "Design a bit-serial sparse multiplier for ternary weights. Calculate energy efficiency and throughput_tops.",
                "Implement a run-length encoded sparse accelerator. Evaluate memory bandwidth savings and latency reduction."
            ],
            "3_quantization_error_propagation": [
                "Analyze quantization error propagation through a 12-layer transformer. Calculate cumulative quantization_error per layer.",
                "Model signal-to-quantization-noise ratio (SQNR) degradation through attention layers. Estimate final accuracy_loss_pct.",
                "Design error compensation circuits for quantization error accumulation. Calculate improved accuracy metrics.",
                "Analyze the impact of ternary weight quantization on attention scores. Estimate quantization_error in softmax outputs.",
                "Model quantization error through layer normalization operations. Calculate expected accuracy_loss_pct.",
                "Design error-aware training for quantization robustness. Evaluate quantization_error reduction techniques.",
                "Analyze cross-layer quantization error correlation. Calculate worst-case and average quantization_error bounds.",
                "Implement statistical quantization error modeling. Estimate confidence intervals for accuracy_loss_pct."
            ],
            "4_weight_storage_mask_locked_rom": [
                "Design a mask-locked ROM architecture for ternary weights. Calculate area overhead and access latency.",
                "Implement a 2-bit ternary encoding scheme for ROM storage. Analyze storage density and throughput_tops for weight loading.",
                "Design a hierarchical ROM structure for transformer weights. Calculate memory bandwidth requirements.",
                "Implement weight compression for mask-locked ROM. Estimate storage savings and accuracy_loss_pct.",
                "Design a multi-bank ROM architecture for parallel weight access. Calculate inference_latency_us improvement.",
                "Create a ROM addressing scheme for efficient weight streaming. Analyze throughput_tops and memory utilization.",
                "Design error-tolerant ROM encoding for manufacturing defects. Calculate yield impact and reliability metrics.",
                "Implement a ROM interface for 128GB/s memory bandwidth. Calculate sustained throughput_tops."
            ],
            "5_transformer_attention_throughput": [
                "Calculate attention computation throughput for 32x32 systolic array. Estimate throughput_tops for Q*K^T operation.",
                "Design an attention accelerator for 12-head multi-head attention. Calculate inference_latency_us per attention layer.",
                "Implement flash attention on the systolic array architecture. Analyze memory bandwidth efficiency.",
                "Design a pipelined attention computation unit. Calculate throughput_tops and latency for sequence length 2048.",
                "Implement tiled attention for long sequences. Calculate inference_latency_us and memory requirements.",
                "Design a sparse attention accelerator for transformer inference. Estimate throughput_tops improvement.",
                "Calculate attention softmax throughput with approximate hardware. Analyze accuracy_loss_pct tradeoff.",
                "Design rotary position embedding (RoPE) hardware. Calculate additional inference_latency_us overhead."
            ],
            "6_kv_cache_compression": [
                "Design a KV-cache compression unit using 8-bit quantization. Calculate memory bandwidth savings.",
                "Implement grouped-query attention (GQA) for KV-cache reduction. Estimate accuracy_loss_pct and latency improvement.",
                "Design a KV-cache eviction policy hardware. Calculate effective cache size and accuracy_impact.",
                "Implement compressed KV-cache with sparse attention. Analyze memory bandwidth and throughput_tops.",
                "Design a streaming KV-cache architecture for long sequences. Calculate inference_latency_us for 2048 tokens.",
                "Implement multi-query attention (MQA) for KV-cache efficiency. Estimate throughput_tops improvement.",
                "Design a KV-cache with dynamic precision allocation. Calculate accuracy_loss_pct vs memory tradeoff.",
                "Implement paged attention for memory-efficient KV-cache. Analyze memory bandwidth utilization."
            ],
            "7_activation_quantization": [
                "Design an 8-bit activation quantizer with dynamic range adaptation. Calculate quantization_error for activations.",
                "Implement per-token activation quantization for transformers. Estimate accuracy_loss_pct impact.",
                "Design a log-scale activation quantizer for wide dynamic range. Calculate quantization_error and throughput.",
                "Implement activation quantization with outlier preservation. Analyze accuracy_loss_pct improvement.",
                "Design a learned step size quantization for activations. Calculate quantization_error reduction.",
                "Implement symmetric vs asymmetric activation quantization comparison. Evaluate accuracy_loss_pct tradeoffs.",
                "Design a layer-adaptive activation quantizer. Calculate per-layer quantization_error bounds.",
                "Implement smooth activation quantization for non-linearities. Estimate cumulative accuracy_loss_pct."
            ],
            "8_memory_bandwidth_analysis": [
                "Analyze memory bandwidth requirements for transformer inference. Calculate required GB/s for 2048 sequence.",
                "Design a memory access pattern optimizer for attention. Calculate effective bandwidth utilization percentage.",
                "Implement double buffering for memory-efficient inference. Analyze inference_latency_us improvement.",
                "Design a prefetch engine for weight and activation streaming. Calculate memory bandwidth saturation point.",
                "Analyze DRAM access patterns for batch-1 inference. Calculate power consumption and bandwidth efficiency.",
                "Design a memory bandwidth allocation strategy for multi-head attention. Estimate throughput_tops improvement.",
                "Implement memory tiling for large attention matrices. Calculate on-chip SRAM requirements.",
                "Design a bandwidth-aware scheduling for transformer layers. Analyze inference_latency_us optimization."
            ],
            "9_softmax_approximation": [
                "Design a hardware-efficient softmax approximation using piecewise linear. Calculate accuracy_loss_pct.",
                "Implement an online softmax algorithm for streaming computation. Estimate inference_latency_us improvement.",
                "Design a logarithmic softmax approximation for numerical stability. Calculate throughput_tops.",
                "Implement approximate softmax with reduced precision exponent. Analyze quantization_error and accuracy.",
                "Design a chunked softmax for long sequences. Calculate memory bandwidth and latency.",
                "Implement a Taylor series softmax approximation. Evaluate accuracy_loss_pct and hardware complexity.",
                "Design a max-subtraction optimized softmax unit. Calculate throughput_tops and area efficiency.",
                "Implement a lookup table based softmax approximation. Analyze accuracy_loss_pct and latency."
            ],
            "10_tops_w_efficiency": [
                "Calculate TOPS/W efficiency for 32x32 ternary MAC array at 5W power budget. Estimate TOPS and efficiency.",
                "Design power gating strategies for idle PEs. Calculate average power reduction and TOPS/W improvement.",
                "Implement clock gating for sparse computation. Estimate dynamic power savings and throughput_tops.",
                "Design a voltage-frequency scaling scheme for inference. Calculate TOPS/W across operating points.",
                "Analyze leakage power contribution at 28nm. Calculate standby power and efficiency metrics.",
                "Design an energy-aware computation scheduler. Estimate TOPS/W for mixed workload.",
                "Implement data movement optimization for power efficiency. Calculate memory power and total TOPS/W.",
                "Design a near-threshold computing mode for efficiency. Analyze throughput_tops vs power tradeoff."
            ]
        }
    
    async def call_deepseek(self, prompt: str, max_tokens: int = 2048) -> Tuple[str, int, float]:
        """Execute DeepSeek API call with timing"""
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        system_prompt = """You are an ML hardware acceleration expert specializing in:
- Ternary weight neural networks and quantization
- Systolic array architectures for inference
- Transformer acceleration and attention optimization
- Memory bandwidth optimization for edge AI
- Power-efficient inference hardware design

Provide detailed technical analysis with specific numerical metrics.
Always include these metrics in your response when applicable:
- quantization_error: numerical value (lower is better, target < 0.01)
- inference_latency_us: latency in microseconds (lower is better, target < 100us)
- accuracy_loss_pct: percentage accuracy degradation (lower is better, target < 1.0%)
- throughput_tops: operations per second in TOPS (higher is better, target > 50 TOPS)

Format metrics as: "metric_name: value" or in JSON format."""

        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7
        }
        
        start_time = time.time()
        try:
            async with self.session.post(
                DEEPSEEK_BASE_URL, 
                headers=headers, 
                json=payload, 
                timeout=aiohttp.ClientTimeout(total=90)
            ) as response:
                response_time_ms = (time.time() - start_time) * 1000
                
                if response.status == 200:
                    data = await response.json()
                    content = data["choices"][0]["message"]["content"]
                    tokens = data.get("usage", {}).get("total_tokens", 0)
                    self.api_calls += 1
                    self.total_tokens += tokens
                    return content, tokens, response_time_ms
                else:
                    error_text = await response.text()
                    return f"API Error {response.status}: {error_text[:200]}", 0, response_time_ms
        except asyncio.TimeoutError:
            return "Timeout after 90s", 0, 90000
        except Exception as e:
            return f"Exception: {str(e)}", 0, (time.time() - start_time) * 1000
    
    def extract_metrics(self, response: str) -> Dict[str, float]:
        """Extract numerical metrics from response text"""
        metrics = {}
        
        # Try JSON parsing first
        json_patterns = [
            r'\{[^{}]*"quantization_error"[^{}]*\}',
            r'\{[^{}]*"inference_latency_us"[^{}]*\}',
            r'\{[^{}]*\}'
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, response, re.DOTALL)
            for match in matches:
                try:
                    parsed = json.loads(match)
                    for key, value in parsed.items():
                        if isinstance(value, (int, float)):
                            metrics[key] = float(value)
                except:
                    pass
        
        # Direct pattern matching for metrics
        metric_patterns = {
            "quantization_error": [
                r"quantization[_\s]*error[:\s]+([0-9.]+)",
                r"quantization_error[:\s]*([0-9.]+)",
                r"QE[:\s]+([0-9.]+)"
            ],
            "inference_latency_us": [
                r"inference[_\s]*latency[:\s]+([0-9.]+)\s*(?:us|μs|microseconds)?",
                r"latency[:\s]+([0-9.]+)\s*us",
                r"inference_latency_us[:\s]*([0-9.]+)"
            ],
            "accuracy_loss_pct": [
                r"accuracy[_\s]*loss[:\s]+([0-9.]+)\s*%?",
                r"accuracy_loss_pct[:\s]*([0-9.]+)",
                r"accuracy[_\s]*degradation[:\s]+([0-9.]+)"
            ],
            "throughput_tops": [
                r"throughput[:\s]+([0-9.]+)\s*(?:TOPS|Tops|tops)",
                r"throughput_tops[:\s]*([0-9.]+)",
                r"TOPS[:\s]+([0-9.]+)"
            ],
            "power_w": [
                r"power[:\s]+([0-9.]+)\s*W",
                r"power[_\s]*consumption[:\s]+([0-9.]+)"
            ],
            "tops_w": [
                r"TOPS/W[:\s]+([0-9.]+)",
                r"energy[_\s]*efficiency[:\s]+([0-9.]+)\s*TOPS/W"
            ]
        }
        
        for metric, patterns in metric_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, response, re.IGNORECASE)
                if match:
                    try:
                        value = float(match.group(1))
                        if metric not in metrics:
                            metrics[metric] = value
                    except:
                        pass
        
        return metrics
    
    def calculate_quality_score(self, metrics: Dict[str, float]) -> float:
        """Calculate quality score based on baseline comparison"""
        if not metrics:
            return 0.5
        
        scores = []
        for key, baseline in QUALITY_BASELINES.items():
            if key in metrics:
                actual = metrics[key]
                if key in ["quantization_error", "inference_latency_us", "accuracy_loss_pct"]:
                    # Lower is better
                    if actual <= baseline:
                        scores.append(1.0)
                    else:
                        scores.append(max(0, 1 - (actual - baseline) / baseline))
                else:
                    # Higher is better (throughput_tops)
                    scores.append(min(1.0, actual / baseline))
        
        return statistics.mean(scores) if scores else 0.5
    
    def detect_signal(self, metrics: Dict[str, float], quality_score: float) -> bool:
        """Determine if result contains meaningful signal vs noise"""
        if not metrics:
            return False
        
        # Signal detected if:
        # 1. Multiple metrics extracted
        # 2. Quality score is reasonable
        # 3. Values are in expected ranges
        
        if len(metrics) >= 2 and quality_score > 0.3:
            # Check for reasonable value ranges
            if "quantization_error" in metrics:
                if 0.001 <= metrics["quantization_error"] <= 0.5:
                    return True
            if "throughput_tops" in metrics:
                if 10 <= metrics["throughput_tops"] <= 200:
                    return True
            if "inference_latency_us" in metrics:
                if 10 <= metrics["inference_latency_us"] <= 500:
                    return True
            if "accuracy_loss_pct" in metrics:
                if 0.1 <= metrics["accuracy_loss_pct"] <= 10:
                    return True
        
        return quality_score > 0.5
    
    async def run_single_simulation(self, sim_id: int, category: str, task: str) -> SimulationResult:
        """Run a single simulation with the DeepSeek API"""
        
        prompt = f"""
{ACCELERATOR_CONFIG}

SIMULATION TASK: {task}

Analyze this specific aspect of the ML accelerator design. Provide:
1. Technical analysis of the approach
2. Numerical results with specific metrics
3. Performance implications for the target workload

Output the following metrics based on your analysis:
- quantization_error: Expected quantization error value
- inference_latency_us: Estimated latency in microseconds
- accuracy_loss_pct: Expected accuracy degradation percentage
- throughput_tops: Estimated throughput in TOPS

Provide specific numerical values with technical justification.
"""
        
        raw_response, tokens, response_time = await self.call_deepseek(prompt)
        metrics = self.extract_metrics(raw_response)
        quality_score = self.calculate_quality_score(metrics)
        signal_detected = self.detect_signal(metrics, quality_score)
        
        return SimulationResult(
            sim_id=sim_id,
            task_category=category,
            task_variation=task[:100],
            prompt_sent=prompt[:500],
            raw_response=raw_response[:2000],
            metrics=metrics,
            quality_score=quality_score,
            signal_detected=signal_detected,
            timestamp=datetime.now().isoformat(),
            tokens_used=tokens,
            response_time_ms=response_time
        )
    
    async def run_all_simulations(self) -> Dict:
        """Run all 80+ simulations"""
        print(f"\n{'='*70}")
        print(f"ML Hardware Simulation - 80+ DeepSeek API Calls")
        print(f"{'='*70}")
        print(f"Start time: {datetime.now().isoformat()}")
        
        self.start_time = time.time()
        
        # Build list of all simulation tasks
        all_simulations = []
        sim_id = 0
        for category, tasks in self.simulation_tasks.items():
            for task in tasks:
                all_simulations.append((sim_id, category, task))
                sim_id += 1
        
        total_sims = len(all_simulations)
        print(f"Total simulations planned: {total_sims}")
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            
            # Run simulations with rate limiting
            batch_size = 5
            for i in range(0, total_sims, batch_size):
                batch = all_simulations[i:i+batch_size]
                
                tasks = [
                    self.run_single_simulation(sim_id, category, task)
                    for sim_id, category, task in batch
                ]
                
                results = await asyncio.gather(*tasks)
                self.results.extend(results)
                
                # Progress report
                completed = min(i + batch_size, total_sims)
                signals = sum(1 for r in self.results if r.signal_detected)
                avg_quality = statistics.mean([r.quality_score for r in self.results])
                
                print(f"\n[{completed}/{total_sims}] Progress")
                print(f"  API Calls: {self.api_calls}")
                print(f"  Total Tokens: {self.total_tokens}")
                print(f"  Signals Detected: {signals}/{len(self.results)}")
                print(f"  Avg Quality Score: {avg_quality:.3f}")
                
                # Brief pause between batches
                await asyncio.sleep(0.3)
        
        return self.generate_summary()
    
    def generate_summary(self) -> Dict:
        """Generate comprehensive summary of all simulations"""
        total_time = time.time() - self.start_time if self.start_time else 0
        
        # Aggregate metrics by category
        category_metrics = {}
        for result in self.results:
            cat = result.task_category
            if cat not in category_metrics:
                category_metrics[cat] = {"metrics": {}, "quality_scores": [], "signals": 0}
            
            category_metrics[cat]["quality_scores"].append(result.quality_score)
            if result.signal_detected:
                category_metrics[cat]["signals"] += 1
            
            for metric, value in result.metrics.items():
                if metric not in category_metrics[cat]["metrics"]:
                    category_metrics[cat]["metrics"][metric] = []
                category_metrics[cat]["metrics"][metric].append(value)
        
        # Calculate overall metrics trends
        all_metric_values = {}
        for result in self.results:
            for metric, value in result.metrics.items():
                if metric not in all_metric_values:
                    all_metric_values[metric] = []
                all_metric_values[metric].append(value)
        
        metrics_trends = {}
        for metric, values in all_metric_values.items():
            if values:
                metrics_trends[metric] = {
                    "mean": statistics.mean(values),
                    "std": statistics.stdev(values) if len(values) > 1 else 0,
                    "min": min(values),
                    "max": max(values),
                    "count": len(values),
                    "below_baseline": sum(1 for v in values if v <= QUALITY_BASELINES.get(metric, float('inf')))
                }
        
        # Signal vs noise analysis
        signals = [r for r in self.results if r.signal_detected]
        noise = [r for r in self.results if not r.signal_detected]
        
        return {
            "summary": {
                "total_simulations": len(self.results),
                "total_api_calls": self.api_calls,
                "total_tokens": self.total_tokens,
                "total_time_seconds": round(total_time, 2),
                "signals_detected": len(signals),
                "noise_detected": len(noise),
                "signal_ratio": len(signals) / len(self.results) if self.results else 0,
                "average_quality_score": statistics.mean([r.quality_score for r in self.results]) if self.results else 0,
                "quality_baselines": QUALITY_BASELINES
            },
            "metrics_trends": metrics_trends,
            "category_analysis": {
                cat: {
                    "simulations": len(data["quality_scores"]),
                    "avg_quality": statistics.mean(data["quality_scores"]) if data["quality_scores"] else 0,
                    "signals": data["signals"],
                    "key_metrics": {
                        metric: {
                            "mean": statistics.mean(values) if values else 0,
                            "count": len(values)
                        }
                        for metric, values in data["metrics"].items() if values
                    }
                }
                for cat, data in category_metrics.items()
            },
            "key_findings": self._extract_key_findings(),
            "baseline_comparison": self._compare_to_baselines(metrics_trends),
            "results": [asdict(r) for r in self.results[-20:]]  # Last 20 results
        }
    
    def _extract_key_findings(self) -> List[str]:
        """Extract key findings from simulation results"""
        findings = []
        
        if not self.results:
            return ["No results to analyze"]
        
        # Best quality scores
        best_results = sorted(self.results, key=lambda r: r.quality_score, reverse=True)[:5]
        findings.append(f"Top quality scores: {[f'{r.quality_score:.2f}' for r in best_results]}")
        
        # Metric extraction success
        total_metrics = sum(len(r.metrics) for r in self.results)
        avg_metrics = total_metrics / len(self.results)
        findings.append(f"Average metrics extracted per simulation: {avg_metrics:.1f}")
        
        # Signal detection rate
        signal_rate = sum(1 for r in self.results if r.signal_detected) / len(self.results) * 100
        findings.append(f"Signal detection rate: {signal_rate:.1f}%")
        
        # Best performing categories
        cat_quality = {}
        for r in self.results:
            if r.task_category not in cat_quality:
                cat_quality[r.task_category] = []
            cat_quality[r.task_category].append(r.quality_score)
        
        if cat_quality:
            best_cat = max(cat_quality.items(), key=lambda x: statistics.mean(x[1]))
            findings.append(f"Best performing category: {best_cat[0]} (avg quality: {statistics.mean(best_cat[1]):.2f})")
        
        return findings
    
    def _compare_to_baselines(self, metrics_trends: Dict) -> Dict:
        """Compare extracted metrics to quality baselines"""
        comparison = {}
        
        for metric, baseline in QUALITY_BASELINES.items():
            if metric in metrics_trends:
                trend = metrics_trends[metric]
                mean_val = trend["mean"]
                
                if metric in ["quantization_error", "inference_latency_us", "accuracy_loss_pct"]:
                    # Lower is better
                    meets_baseline = mean_val <= baseline
                    margin = (baseline - mean_val) / baseline * 100
                else:
                    # Higher is better
                    meets_baseline = mean_val >= baseline
                    margin = (mean_val - baseline) / baseline * 100
                
                comparison[metric] = {
                    "baseline": baseline,
                    "actual_mean": round(mean_val, 4),
                    "meets_baseline": meets_baseline,
                    "margin_pct": round(margin, 2),
                    "samples": trend["count"]
                }
        
        return comparison


async def main():
    """Main entry point"""
    simulator = MLHardwareSimulator()
    summary = await simulator.run_all_simulations()
    
    # Save results
    output_path = "/home/z/my-project/research/deepseek_orchestration/ml_hardware_results.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n{'='*70}")
    print(f"SIMULATION COMPLETE")
    print(f"{'='*70}")
    print(f"Total API Calls: {summary['summary']['total_api_calls']}")
    print(f"Total Simulations: {summary['summary']['total_simulations']}")
    print(f"Signal Detection Rate: {summary['summary']['signal_ratio']*100:.1f}%")
    print(f"Average Quality Score: {summary['summary']['average_quality_score']:.3f}")
    print(f"Results saved to: {output_path}")
    
    print(f"\nKEY FINDINGS:")
    for finding in summary["key_findings"]:
        print(f"  - {finding}")
    
    print(f"\nBASELINE COMPARISON:")
    for metric, data in summary.get("baseline_comparison", {}).items():
        status = "✓ MEETS" if data["meets_baseline"] else "✗ BELOW"
        print(f"  {metric}: {data['actual_mean']:.4f} vs baseline {data['baseline']} [{status}]")
    
    return summary


if __name__ == "__main__":
    asyncio.run(main())
