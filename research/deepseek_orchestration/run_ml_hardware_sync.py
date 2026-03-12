#!/usr/bin/env python3
"""
ML Hardware Simulation - Sequential execution with progress tracking
"""

import os
import sys
import json
import time
import requests
import statistics
import re
from datetime import datetime
from typing import Dict, List

# API Configuration
API_KEY = 'sk-2c32887fc62b4016b6ff03f982968b76'
URL = 'https://api.deepseek.com/v1/chat/completions'

# Output path
OUTPUT_PATH = "/home/z/my-project/research/deepseek_orchestration/ml_hardware_results.json"

# Quality baselines
BASELINES = {
    "quantization_error": 0.01,
    "inference_latency_us": 100,
    "accuracy_loss_pct": 1.0,
    "throughput_tops": 50
}

# Simulation tasks - 80+ tasks across 10 categories
TASKS = [
    # Category 1: Ternary Weight Quantizer
    ("ternary_quantizer", "Design symmetric threshold ternary quantizer FP32->ternary. Provide quantization_error value."),
    ("ternary_quantizer", "Implement learned threshold quantization with gradient optimization. Estimate quantization_error."),
    ("ternary_quantizer", "Design per-channel scaling ternary quantizer. Calculate quantization_error per transformer layer."),
    ("ternary_quantizer", "Implement approximate ternary quantization with efficient rounding. Output quantization_error."),
    ("ternary_quantizer", "Design dynamic threshold quantizer adapting per layer. Estimate accuracy_loss_pct."),
    ("ternary_quantizer", "Create sparse-aware ternary quantizer for weight distribution. Calculate quantization_error."),
    ("ternary_quantizer", "Design two-stage FP32->INT8->Ternary quantizer. Analyze cumulative quantization_error."),
    ("ternary_quantizer", "Implement ternary quantizer with error feedback. Evaluate residual quantization_error."),
    ("ternary_quantizer", "Design 2-bit hardware ternary quantization. Calculate throughput_tops for weight loading."),
    
    # Category 2: Sparse MatMul Accelerator
    ("sparse_matmul", "Design sparse matrix unit for ternary weights. Calculate effective throughput_tops."),
    ("sparse_matmul", "Implement CSR format accelerator for ternary matrices. Analyze memory bandwidth utilization."),
    ("sparse_matmul", "Design systolic array for sparse ternary weights. Calculate inference_latency_us for attention."),
    ("sparse_matmul", "Implement zero-skipping logic in MAC array. Estimate throughput_tops improvement."),
    ("sparse_matmul", "Design index-based sparse accelerator for pruning. Calculate accuracy_loss_pct vs throughput."),
    ("sparse_matmul", "Create hybrid dense-sparse accelerator. Analyze inference_latency_us for mixed sparsity."),
    ("sparse_matmul", "Design bit-serial sparse multiplier for ternary. Calculate throughput_tops."),
    ("sparse_matmul", "Implement run-length encoded sparse accelerator. Evaluate bandwidth savings."),
    
    # Category 3: Quantization Error Propagation
    ("error_propagation", "Analyze quantization error through 12-layer transformer. Calculate cumulative quantization_error."),
    ("error_propagation", "Model SQNR degradation through attention layers. Estimate accuracy_loss_pct."),
    ("error_propagation", "Design error compensation circuits. Calculate improved accuracy metrics."),
    ("error_propagation", "Analyze ternary quantization on attention scores. Estimate softmax quantization_error."),
    ("error_propagation", "Model quantization error through layer norm. Calculate accuracy_loss_pct."),
    ("error_propagation", "Design error-aware training for robustness. Evaluate quantization_error reduction."),
    ("error_propagation", "Analyze cross-layer quantization correlation. Calculate quantization_error bounds."),
    ("error_propagation", "Implement statistical quantization modeling. Estimate accuracy_loss_pct."),
    
    # Category 4: Mask-Locked ROM
    ("mask_locked_rom", "Design mask-locked ROM for ternary weights. Calculate area and latency."),
    ("mask_locked_rom", "Implement 2-bit ternary encoding for ROM. Analyze throughput_tops."),
    ("mask_locked_rom", "Design hierarchical ROM for transformer weights. Calculate bandwidth requirements."),
    ("mask_locked_rom", "Implement weight compression for ROM. Estimate accuracy_loss_pct."),
    ("mask_locked_rom", "Design multi-bank ROM for parallel access. Calculate inference_latency_us improvement."),
    ("mask_locked_rom", "Create ROM addressing for streaming. Analyze throughput_tops."),
    ("mask_locked_rom", "Design error-tolerant ROM for defects. Calculate yield metrics."),
    ("mask_locked_rom", "Implement ROM interface for 128GB/s. Calculate throughput_tops."),
    
    # Category 5: Attention Throughput
    ("attention_throughput", "Calculate attention throughput for 32x32 array. Estimate throughput_tops for Q*K^T."),
    ("attention_throughput", "Design 12-head multi-head attention accelerator. Calculate inference_latency_us."),
    ("attention_throughput", "Implement flash attention on systolic array. Analyze bandwidth efficiency."),
    ("attention_throughput", "Design pipelined attention computation. Calculate throughput_tops for seq 2048."),
    ("attention_throughput", "Implement tiled attention for long sequences. Calculate inference_latency_us."),
    ("attention_throughput", "Design sparse attention accelerator. Estimate throughput_tops improvement."),
    ("attention_throughput", "Calculate approximate softmax throughput. Analyze accuracy_loss_pct."),
    ("attention_throughput", "Design RoPE hardware. Calculate inference_latency_us overhead."),
    
    # Category 6: KV-Cache Compression
    ("kv_cache", "Design KV-cache compression with 8-bit quantization. Calculate bandwidth savings."),
    ("kv_cache", "Implement grouped-query attention for KV reduction. Estimate accuracy_loss_pct."),
    ("kv_cache", "Design KV-cache eviction policy hardware. Calculate cache size and accuracy."),
    ("kv_cache", "Implement compressed KV-cache with sparse attention. Analyze throughput_tops."),
    ("kv_cache", "Design streaming KV-cache for long sequences. Calculate inference_latency_us."),
    ("kv_cache", "Implement multi-query attention for efficiency. Estimate throughput_tops."),
    ("kv_cache", "Design KV-cache with dynamic precision. Calculate accuracy_loss_pct vs memory."),
    ("kv_cache", "Implement paged attention for efficiency. Analyze bandwidth utilization."),
    
    # Category 7: Activation Quantization
    ("activation_quant", "Design 8-bit activation quantizer with dynamic range. Calculate quantization_error."),
    ("activation_quant", "Implement per-token activation quantization. Estimate accuracy_loss_pct."),
    ("activation_quant", "Design log-scale activation quantizer. Calculate quantization_error."),
    ("activation_quant", "Implement activation quantization with outlier preservation. Analyze accuracy_loss_pct."),
    ("activation_quant", "Design learned step size quantization. Calculate quantization_error reduction."),
    ("activation_quant", "Compare symmetric vs asymmetric activation quantization. Evaluate accuracy_loss_pct."),
    ("activation_quant", "Design layer-adaptive activation quantizer. Calculate quantization_error."),
    ("activation_quant", "Implement smooth activation quantization. Estimate accuracy_loss_pct."),
    
    # Category 8: Memory Bandwidth
    ("memory_bandwidth", "Analyze memory bandwidth for transformer inference. Calculate required GB/s."),
    ("memory_bandwidth", "Design memory access optimizer for attention. Calculate utilization."),
    ("memory_bandwidth", "Implement double buffering for efficiency. Analyze inference_latency_us."),
    ("memory_bandwidth", "Design prefetch engine for weights. Calculate saturation point."),
    ("memory_bandwidth", "Analyze DRAM patterns for batch-1 inference. Calculate bandwidth efficiency."),
    ("memory_bandwidth", "Design bandwidth allocation for multi-head attention. Estimate throughput_tops."),
    ("memory_bandwidth", "Implement memory tiling for attention. Calculate SRAM requirements."),
    ("memory_bandwidth", "Design bandwidth-aware scheduling. Analyze inference_latency_us."),
    
    # Category 9: Softmax Approximation
    ("softmax_approx", "Design piecewise linear softmax approximation. Calculate accuracy_loss_pct."),
    ("softmax_approx", "Implement online softmax for streaming. Estimate inference_latency_us improvement."),
    ("softmax_approx", "Design logarithmic softmax for stability. Calculate throughput_tops."),
    ("softmax_approx", "Implement reduced precision exponent softmax. Analyze quantization_error."),
    ("softmax_approx", "Design chunked softmax for long sequences. Calculate latency."),
    ("softmax_approx", "Implement Taylor series softmax approximation. Evaluate accuracy_loss_pct."),
    ("softmax_approx", "Design max-subtraction optimized softmax. Calculate throughput_tops."),
    ("softmax_approx", "Implement LUT-based softmax approximation. Analyze accuracy_loss_pct."),
    
    # Category 10: TOPS/W Efficiency
    ("tops_w_efficiency", "Calculate TOPS/W for 32x32 ternary array at 5W. Estimate throughput_tops."),
    ("tops_w_efficiency", "Design power gating for idle PEs. Calculate power reduction and TOPS/W."),
    ("tops_w_efficiency", "Implement clock gating for sparse computation. Estimate throughput_tops."),
    ("tops_w_efficiency", "Design voltage-frequency scaling for inference. Calculate TOPS/W."),
    ("tops_w_efficiency", "Analyze 28nm leakage power. Calculate standby power and efficiency."),
    ("tops_w_efficiency", "Design energy-aware computation scheduler. Estimate TOPS/W."),
    ("tops_w_efficiency", "Implement data movement optimization. Calculate memory power and TOPS/W."),
    ("tops_w_efficiency", "Design near-threshold computing mode. Analyze throughput_tops vs power.")
]

SYSTEM_PROMPT = """You are an ML hardware acceleration expert. Analyze the task and provide specific numerical metrics.

Accelerator: 32x32 systolic array (1024 PEs), Ternary weights {-1,0,+1} in 2 bits, 8-bit activations, 1GHz clock, 256KB SRAM, 128GB/s bandwidth, 5W power budget.
Target: Transformer inference (2048 seq, 768 hidden, 12 heads, 12 layers).

Output these metrics with numerical values:
- quantization_error: value (target < 0.01)
- inference_latency_us: value in microseconds (target < 100)
- accuracy_loss_pct: percentage (target < 1.0)
- throughput_tops: TOPS value (target > 50)

Format: "metric_name: value" with brief justification."""

def call_api(prompt: str) -> tuple:
    """Call DeepSeek API"""
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt}
        ],
        'max_tokens': 800,
        'temperature': 0.7
    }
    
    start = time.time()
    try:
        resp = requests.post(URL, headers=headers, json=payload, timeout=30)
        elapsed = (time.time() - start) * 1000
        
        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 0)
            return content, tokens, elapsed, None
        else:
            return f"Error: {resp.status_code}", 0, elapsed, resp.text[:100]
    except Exception as e:
        return f"Exception: {str(e)[:100]}", 0, (time.time() - start) * 1000, str(e)

def extract_metrics(text: str) -> dict:
    """Extract metrics from response"""
    metrics = {}
    
    patterns = {
        "quantization_error": r"quantization[_\s]*error[:\s]*([0-9.]+)",
        "inference_latency_us": r"(?:inference[_\s]*)?latency[:\s]*([0-9.]+)\s*(?:us|μs)?",
        "accuracy_loss_pct": r"accuracy[_\s]*(?:loss|degradation)[:\s]*([0-9.]+)\s*%?",
        "throughput_tops": r"throughput[:\s]*([0-9.]+)\s*(?:TOPS)?",
        "tops_w": r"(?:TOPS/W|efficiency)[:\s]*([0-9.]+)",
        "power_w": r"power[:\s]*([0-9.]+)\s*W"
    }
    
    for metric, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                metrics[metric] = float(match.group(1))
            except:
                pass
    
    # JSON extraction
    json_matches = re.findall(r'\{[^{}]+\}', text)
    for jm in json_matches:
        try:
            parsed = json.loads(jm)
            for k, v in parsed.items():
                if isinstance(v, (int, float)):
                    metrics[k] = float(v)
        except:
            pass
    
    return metrics

def calc_quality(metrics: dict) -> float:
    """Calculate quality score"""
    if not metrics:
        return 0.5
    scores = []
    for key, baseline in BASELINES.items():
        if key in metrics:
            val = metrics[key]
            if key in ["quantization_error", "inference_latency_us", "accuracy_loss_pct"]:
                scores.append(1.0 if val <= baseline else max(0, 1 - (val - baseline) / baseline))
            else:
                scores.append(min(1.0, val / baseline))
    return statistics.mean(scores) if scores else 0.5

def detect_signal(metrics: dict, quality: float) -> bool:
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

def main():
    print(f"\n{'='*60}")
    print(f"ML Hardware Simulation - {len(TASKS)} Tasks")
    print(f"Start: {datetime.now().isoformat()}")
    print(f"{'='*60}\n")
    
    results = []
    api_calls = 0
    total_tokens = 0
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    for i, (category, task) in enumerate(TASKS):
        print(f"[{i+1}/{len(TASKS)}] {category}: {task[:50]}...")
        
        response, tokens, time_ms, error = call_api(task)
        
        if error is None:
            api_calls += 1
            total_tokens += tokens
        
        metrics = extract_metrics(response)
        quality = calc_quality(metrics)
        signal = detect_signal(metrics, quality)
        
        result = {
            "sim_id": i,
            "category": category,
            "task": task,
            "response": response[:800],
            "metrics": metrics,
            "quality_score": round(quality, 3),
            "signal_detected": signal,
            "tokens": tokens,
            "time_ms": round(time_ms, 1)
        }
        results.append(result)
        
        # Progress every 10
        if (i + 1) % 10 == 0:
            signals = sum(1 for r in results if r["signal_detected"])
            avg_q = statistics.mean([r["quality_score"] for r in results])
            print(f"  -> Progress: {i+1}/{len(TASKS)}, Signals: {signals}, AvgQuality: {avg_q:.2f}")
            
            # Save checkpoint
            with open(OUTPUT_PATH, "w") as f:
                json.dump({"results": results, "checkpoint": True}, f, indent=2)
        
        time.sleep(0.15)  # Rate limiting
    
    # Final summary
    signals = sum(1 for r in results if r["signal_detected"])
    avg_quality = statistics.mean([r["quality_score"] for r in results])
    
    # Aggregate metrics
    all_metrics = {}
    for r in results:
        for k, v in r["metrics"].items():
            if k not in all_metrics:
                all_metrics[k] = []
            all_metrics[k].append(v)
    
    metrics_trends = {}
    for k, vals in all_metrics.items():
        if vals:
            metrics_trends[k] = {
                "mean": round(statistics.mean(vals), 4),
                "min": round(min(vals), 4),
                "max": round(max(vals), 4),
                "std": round(statistics.stdev(vals), 4) if len(vals) > 1 else 0,
                "count": len(vals),
                "below_baseline": sum(1 for v in vals if v <= BASELINES.get(k, float('inf')))
            }
    
    final_output = {
        "summary": {
            "total_simulations": len(results),
            "total_api_calls": api_calls,
            "total_tokens": total_tokens,
            "signals_detected": signals,
            "signal_ratio": round(signals / len(results), 3) if results else 0,
            "average_quality_score": round(avg_quality, 3),
            "quality_baselines": BASELINES
        },
        "metrics_trends": metrics_trends,
        "key_findings": [
            f"Total simulations completed: {len(results)}",
            f"Signal detection rate: {signals/len(results)*100:.1f}%",
            f"Average quality score: {avg_quality:.3f}",
            f"Total API tokens used: {total_tokens}"
        ],
        "baseline_comparison": {
            k: {
                "baseline": v,
                "actual_mean": metrics_trends.get(k, {}).get("mean", "N/A"),
                "samples": metrics_trends.get(k, {}).get("count", 0)
            }
            for k, v in BASELINES.items()
        },
        "results": results
    }
    
    with open(OUTPUT_PATH, "w") as f:
        json.dump(final_output, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"SIMULATION COMPLETE")
    print(f"{'='*60}")
    print(f"Total Simulations: {len(results)}")
    print(f"API Calls: {api_calls}")
    print(f"Total Tokens: {total_tokens}")
    print(f"Signals: {signals}/{len(results)} ({signals/len(results)*100:.1f}%)")
    print(f"Avg Quality: {avg_quality:.3f}")
    print(f"\nResults saved to: {OUTPUT_PATH}")
    
    print(f"\nMetrics Trends:")
    for k, v in metrics_trends.items():
        print(f"  {k}: mean={v['mean']}, n={v['count']}")

if __name__ == "__main__":
    main()
