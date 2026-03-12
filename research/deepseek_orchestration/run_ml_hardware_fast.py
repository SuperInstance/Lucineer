#!/usr/bin/env python3
"""
ML Hardware Simulation Runner - Optimized for 80+ DeepSeek API Calls
With incremental saving and better error handling
"""

import os
import sys
import json
import time
import asyncio
import aiohttp
import statistics
import re
from datetime import datetime
from typing import Dict, List, Tuple
from dataclasses import dataclass, asdict

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

# Accelerator config for prompts
ACCEL_CONFIG = """
Accelerator: 32x32 systolic array (1024 PEs)
Ternary weights: {-1, 0, +1} in 2 bits
8-bit activations, 1GHz clock
256KB SRAM, 128GB/s bandwidth
Target: Transformer (2048 seq, 768 hidden, 12 heads)
"""

@dataclass
class SimResult:
    sim_id: int
    category: str
    task: str
    response: str
    metrics: Dict[str, float]
    quality: float
    signal: bool
    tokens: int
    time_ms: float

class MLHardwareSim:
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.results: List[SimResult] = []
        self.api_calls = 0
        self.total_tokens = 0
        self.session = None
        
        # 10 categories with 8+ tasks each = 80+ simulations
        self.tasks = self._build_tasks()
    
    def _build_tasks(self) -> List[Tuple[str, str]]:
        """Build 80+ simulation tasks"""
        return [
            # 1. Ternary Weight Quantizer (9 tasks)
            ("1_ternary_quantizer", "Design symmetric threshold ternary quantizer for FP32->ternary. Calculate quantization_error."),
            ("1_ternary_quantizer", "Implement learned threshold quantization with gradient optimization. Estimate quantization_error."),
            ("1_ternary_quantizer", "Design per-channel scaling ternary quantizer. Calculate expected quantization_error per layer."),
            ("1_ternary_quantizer", "Implement approximate ternary quantization with efficient rounding. Evaluate quantization_error."),
            ("1_ternary_quantizer", "Design dynamic threshold quantizer adapting per layer. Estimate accuracy_loss_pct."),
            ("1_ternary_quantizer", "Create sparse-aware ternary quantizer exploiting weight distribution. Calculate compression and quantization_error."),
            ("1_ternary_quantizer", "Design two-stage FP32->INT8->Ternary quantizer. Analyze cumulative quantization_error."),
            ("1_ternary_quantizer", "Implement ternary quantizer with error feedback. Evaluate residual quantization_error."),
            ("1_ternary_quantizer", "Design 2-bit hardware-efficient ternary quantization. Calculate throughput_tops for weight loading."),
            
            # 2. Sparse MatMul Accelerator (8 tasks)
            ("2_sparse_matmul", "Design sparse matrix multiplication unit for ternary weights. Calculate effective throughput_tops."),
            ("2_sparse_matmul", "Implement CSR format accelerator for ternary matrices. Analyze memory bandwidth utilization."),
            ("2_sparse_matmul", "Design systolic array optimized for sparse ternary. Calculate inference_latency_us for attention."),
            ("2_sparse_matmul", "Implement zero-skipping logic in MAC array. Estimate throughput_tops improvement."),
            ("2_sparse_matmul", "Design index-based sparse accelerator for structured pruning. Calculate accuracy vs throughput tradeoff."),
            ("2_sparse_matmul", "Create hybrid dense-sparse accelerator. Analyze inference_latency_us for mixed sparsity."),
            ("2_sparse_matmul", "Design bit-serial sparse multiplier for ternary. Calculate energy efficiency and throughput_tops."),
            ("2_sparse_matmul", "Implement run-length encoded sparse accelerator. Evaluate bandwidth savings."),
            
            # 3. Quantization Error Propagation (8 tasks)
            ("3_error_propagation", "Analyze quantization error propagation through 12-layer transformer. Calculate cumulative quantization_error."),
            ("3_error_propagation", "Model SQNR degradation through attention layers. Estimate final accuracy_loss_pct."),
            ("3_error_propagation", "Design error compensation circuits for quantization. Calculate improved accuracy metrics."),
            ("3_error_propagation", "Analyze ternary quantization impact on attention scores. Estimate quantization_error in softmax."),
            ("3_error_propagation", "Model quantization error through layer norm. Calculate expected accuracy_loss_pct."),
            ("3_error_propagation", "Design error-aware training for robustness. Evaluate quantization_error reduction."),
            ("3_error_propagation", "Analyze cross-layer quantization error correlation. Calculate worst-case quantization_error bounds."),
            ("3_error_propagation", "Implement statistical quantization error modeling. Estimate accuracy_loss_pct confidence."),
            
            # 4. Weight Storage Mask-Locked ROM (8 tasks)
            ("4_mask_locked_rom", "Design mask-locked ROM architecture for ternary weights. Calculate area and access latency."),
            ("4_mask_locked_rom", "Implement 2-bit ternary encoding for ROM storage. Analyze density and throughput_tops."),
            ("4_mask_locked_rom", "Design hierarchical ROM for transformer weights. Calculate memory bandwidth requirements."),
            ("4_mask_locked_rom", "Implement weight compression for mask-locked ROM. Estimate storage savings and accuracy_loss_pct."),
            ("4_mask_locked_rom", "Design multi-bank ROM for parallel access. Calculate inference_latency_us improvement."),
            ("4_mask_locked_rom", "Create ROM addressing for efficient streaming. Analyze throughput_tops and utilization."),
            ("4_mask_locked_rom", "Design error-tolerant ROM for defects. Calculate yield and reliability."),
            ("4_mask_locked_rom", "Implement ROM interface for 128GB/s bandwidth. Calculate sustained throughput_tops."),
            
            # 5. Transformer Attention Throughput (8 tasks)
            ("5_attention_throughput", "Calculate attention throughput for 32x32 systolic array. Estimate throughput_tops for Q*K^T."),
            ("5_attention_throughput", "Design 12-head multi-head attention accelerator. Calculate inference_latency_us per layer."),
            ("5_attention_throughput", "Implement flash attention on systolic array. Analyze memory bandwidth efficiency."),
            ("5_attention_throughput", "Design pipelined attention computation. Calculate throughput_tops for 2048 sequence."),
            ("5_attention_throughput", "Implement tiled attention for long sequences. Calculate inference_latency_us."),
            ("5_attention_throughput", "Design sparse attention accelerator. Estimate throughput_tops improvement."),
            ("5_attention_throughput", "Calculate approximate softmax throughput. Analyze accuracy_loss_pct tradeoff."),
            ("5_attention_throughput", "Design RoPE hardware. Calculate additional inference_latency_us."),
            
            # 6. KV-Cache Compression (8 tasks)
            ("6_kv_cache", "Design KV-cache compression with 8-bit quantization. Calculate bandwidth savings."),
            ("6_kv_cache", "Implement grouped-query attention for KV reduction. Estimate accuracy_loss_pct and latency."),
            ("6_kv_cache", "Design KV-cache eviction policy hardware. Calculate cache size and accuracy impact."),
            ("6_kv_cache", "Implement compressed KV-cache with sparse attention. Analyze bandwidth and throughput_tops."),
            ("6_kv_cache", "Design streaming KV-cache for long sequences. Calculate inference_latency_us for 2048 tokens."),
            ("6_kv_cache", "Implement multi-query attention for efficiency. Estimate throughput_tops improvement."),
            ("6_kv_cache", "Design KV-cache with dynamic precision. Calculate accuracy vs memory tradeoff."),
            ("6_kv_cache", "Implement paged attention for memory efficiency. Analyze bandwidth utilization."),
            
            # 7. Activation Quantization (8 tasks)
            ("7_activation_quant", "Design 8-bit activation quantizer with dynamic range. Calculate quantization_error."),
            ("7_activation_quant", "Implement per-token activation quantization. Estimate accuracy_loss_pct."),
            ("7_activation_quant", "Design log-scale activation quantizer. Calculate quantization_error and throughput."),
            ("7_activation_quant", "Implement activation quantization with outlier preservation. Analyze accuracy_loss_pct."),
            ("7_activation_quant", "Design learned step size quantization. Calculate quantization_error reduction."),
            ("7_activation_quant", "Compare symmetric vs asymmetric activation quantization. Evaluate accuracy_loss_pct."),
            ("7_activation_quant", "Design layer-adaptive activation quantizer. Calculate per-layer quantization_error."),
            ("7_activation_quant", "Implement smooth activation quantization. Estimate cumulative accuracy_loss_pct."),
            
            # 8. Memory Bandwidth Analysis (8 tasks)
            ("8_memory_bandwidth", "Analyze memory bandwidth for transformer inference. Calculate required GB/s for 2048 sequence."),
            ("8_memory_bandwidth", "Design memory access optimizer for attention. Calculate effective utilization."),
            ("8_memory_bandwidth", "Implement double buffering for memory efficiency. Analyze inference_latency_us improvement."),
            ("8_memory_bandwidth", "Design prefetch engine for weight streaming. Calculate saturation point."),
            ("8_memory_bandwidth", "Analyze DRAM patterns for batch-1 inference. Calculate power and bandwidth efficiency."),
            ("8_memory_bandwidth", "Design bandwidth allocation for multi-head attention. Estimate throughput_tops."),
            ("8_memory_bandwidth", "Implement memory tiling for attention matrices. Calculate SRAM requirements."),
            ("8_memory_bandwidth", "Design bandwidth-aware layer scheduling. Analyze inference_latency_us."),
            
            # 9. Softmax Approximation (8 tasks)
            ("9_softmax_approx", "Design piecewise linear softmax approximation. Calculate accuracy_loss_pct."),
            ("9_softmax_approx", "Implement online softmax for streaming. Estimate inference_latency_us improvement."),
            ("9_softmax_approx", "Design logarithmic softmax for stability. Calculate throughput_tops."),
            ("9_softmax_approx", "Implement reduced precision exponent softmax. Analyze quantization_error."),
            ("9_softmax_approx", "Design chunked softmax for long sequences. Calculate bandwidth and latency."),
            ("9_softmax_approx", "Implement Taylor series softmax approximation. Evaluate accuracy_loss_pct."),
            ("9_softmax_approx", "Design max-subtraction optimized softmax. Calculate throughput_tops."),
            ("9_softmax_approx", "Implement LUT-based softmax approximation. Analyze accuracy_loss_pct."),
            
            # 10. TOPS/W Efficiency (8 tasks)
            ("10_tops_w", "Calculate TOPS/W for 32x32 ternary array at 5W. Estimate throughput_tops and efficiency."),
            ("10_tops_w", "Design power gating for idle PEs. Calculate power reduction and TOPS/W."),
            ("10_tops_w", "Implement clock gating for sparse computation. Estimate dynamic power and throughput_tops."),
            ("10_tops_w", "Design voltage-frequency scaling for inference. Calculate TOPS/W across operating points."),
            ("10_tops_w", "Analyze 28nm leakage power contribution. Calculate standby power and efficiency."),
            ("10_tops_w", "Design energy-aware computation scheduler. Estimate TOPS/W for mixed workload."),
            ("10_tops_w", "Implement data movement optimization. Calculate memory power and total TOPS/W."),
            ("10_tops_w", "Design near-threshold computing mode. Analyze throughput_tops vs power.")
        ]
    
    async def call_api(self, prompt: str) -> Tuple[str, int, float]:
        """Call DeepSeek API"""
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        system = """You are an ML hardware expert. Analyze and provide specific metrics:
- quantization_error: numerical value (target < 0.01)
- inference_latency_us: latency in microseconds (target < 100)
- accuracy_loss_pct: accuracy degradation % (target < 1.0)
- throughput_tops: TOPS (target > 50)

Format: "metric_name: value" in your response."""
        
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1024,
            "temperature": 0.7
        }
        
        start = time.time()
        try:
            async with self.session.post(
                DEEPSEEK_BASE_URL,
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=45)
            ) as resp:
                elapsed = (time.time() - start) * 1000
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    tokens = data.get("usage", {}).get("total_tokens", 0)
                    self.api_calls += 1
                    self.total_tokens += tokens
                    return content, tokens, elapsed
                else:
                    return f"Error: {resp.status}", 0, elapsed
        except Exception as e:
            return f"Exception: {str(e)[:100]}", 0, (time.time() - start) * 1000
    
    def extract_metrics(self, text: str) -> Dict[str, float]:
        """Extract metrics from response"""
        metrics = {}
        
        patterns = {
            "quantization_error": r"quantization[_\s]*error[:\s]+([0-9.]+)",
            "inference_latency_us": r"(?:inference[_\s]*)?latency[:\s]+([0-9.]+)\s*(?:us|μs)?",
            "accuracy_loss_pct": r"accuracy[_\s]*(?:loss|degradation)[:\s]+([0-9.]+)\s*%?",
            "throughput_tops": r"throughput[:\s]+([0-9.]+)\s*(?:TOPS|Tops)?",
            "tops_w": r"TOPS/W[:\s]+([0-9.]+)",
            "power_w": r"power[:\s]+([0-9.]+)\s*W"
        }
        
        for metric, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    metrics[metric] = float(match.group(1))
                except:
                    pass
        
        # Try JSON extraction
        json_matches = re.findall(r'\{[^{}]+\}', text)
        for jm in json_matches:
            try:
                parsed = json.loads(jm)
                for k, v in parsed.items():
                    if isinstance(v, (int, float)) and k not in metrics:
                        metrics[k] = float(v)
            except:
                pass
        
        return metrics
    
    def calc_quality(self, metrics: Dict[str, float]) -> float:
        """Calculate quality score"""
        if not metrics:
            return 0.5
        scores = []
        for key, baseline in QUALITY_BASELINES.items():
            if key in metrics:
                val = metrics[key]
                if key in ["quantization_error", "inference_latency_us", "accuracy_loss_pct"]:
                    scores.append(1.0 if val <= baseline else max(0, 1 - (val - baseline) / baseline))
                else:
                    scores.append(min(1.0, val / baseline))
        return statistics.mean(scores) if scores else 0.5
    
    def detect_signal(self, metrics: Dict[str, float], quality: float) -> bool:
        """Detect signal vs noise"""
        if len(metrics) >= 1 and quality > 0.3:
            for k, v in metrics.items():
                if k == "quantization_error" and 0.001 <= v <= 0.5:
                    return True
                if k == "throughput_tops" and 10 <= v <= 200:
                    return True
                if k == "inference_latency_us" and 5 <= v <= 500:
                    return True
                if k == "accuracy_loss_pct" and 0.05 <= v <= 10:
                    return True
        return quality > 0.5
    
    async def run_sim(self, sim_id: int, category: str, task: str) -> SimResult:
        """Run single simulation"""
        prompt = f"{ACCEL_CONFIG}\nTask: {task}\nProvide analysis with specific metrics."
        
        resp, tokens, time_ms = await self.call_api(prompt)
        metrics = self.extract_metrics(resp)
        quality = self.calc_quality(metrics)
        signal = self.detect_signal(metrics, quality)
        
        return SimResult(
            sim_id=sim_id,
            category=category,
            task=task[:80],
            response=resp[:1000],
            metrics=metrics,
            quality=quality,
            signal=signal,
            tokens=tokens,
            time_ms=time_ms
        )
    
    def save_results(self):
        """Save results incrementally"""
        summary = {
            "summary": {
                "total_simulations": len(self.results),
                "total_api_calls": self.api_calls,
                "total_tokens": self.total_tokens,
                "signals": sum(1 for r in self.results if r.signal),
                "avg_quality": statistics.mean([r.quality for r in self.results]) if self.results else 0
            },
            "metrics_trends": {},
            "results": [asdict(r) for r in self.results]
        }
        
        # Aggregate metrics
        all_metrics = {}
        for r in self.results:
            for k, v in r.metrics.items():
                if k not in all_metrics:
                    all_metrics[k] = []
                all_metrics[k].append(v)
        
        for k, vals in all_metrics.items():
            if vals:
                summary["metrics_trends"][k] = {
                    "mean": round(statistics.mean(vals), 4),
                    "min": round(min(vals), 4),
                    "max": round(max(vals), 4),
                    "count": len(vals)
                }
        
        with open(self.output_path, "w") as f:
            json.dump(summary, f, indent=2)
    
    async def run_all(self):
        """Run all simulations"""
        print(f"\n{'='*60}")
        print(f"ML Hardware Simulation - {len(self.tasks)} Tasks")
        print(f"{'='*60}")
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            
            for i, (cat, task) in enumerate(self.tasks):
                result = await self.run_sim(i, cat, task)
                self.results.append(result)
                
                # Save every 10 results
                if (i + 1) % 10 == 0:
                    self.save_results()
                    signals = sum(1 for r in self.results if r.signal)
                    avg_q = statistics.mean([r.quality for r in self.results])
                    print(f"[{i+1}/{len(self.tasks)}] Calls: {self.api_calls}, Signals: {signals}, AvgQuality: {avg_q:.2f}")
                
                await asyncio.sleep(0.2)
        
        self.save_results()
        return self.results

async def main():
    output_path = "/home/z/my-project/research/deepseek_orchestration/ml_hardware_results.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    sim = MLHardwareSim(output_path)
    results = await sim.run_all()
    
    print(f"\n{'='*60}")
    print(f"COMPLETE")
    print(f"{'='*60}")
    print(f"Total Simulations: {len(results)}")
    print(f"Total API Calls: {sim.api_calls}")
    print(f"Total Tokens: {sim.total_tokens}")
    
    # Print summary
    signals = sum(1 for r in results if r.signal)
    print(f"Signals: {signals}/{len(results)} ({signals/len(results)*100:.1f}%)")
    
    # Print metrics trends
    all_m = {}
    for r in results:
        for k, v in r.metrics.items():
            if k not in all_m:
                all_m[k] = []
            all_m[k].append(v)
    
    print(f"\nMetrics Summary:")
    for k, vals in all_m.items():
        print(f"  {k}: mean={statistics.mean(vals):.4f}, n={len(vals)}")
    
    print(f"\nResults saved to: {output_path}")

if __name__ == "__main__":
    asyncio.run(main())
