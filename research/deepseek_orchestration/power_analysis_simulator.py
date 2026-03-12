#!/usr/bin/env python3
"""
Power Analysis Simulator for Mask-Locked Inference Chip
Optimized version with sequential API calls and progress saving
"""

import requests
import json
import time
import re
import os
from datetime import datetime

# Configuration
API_KEY = "sk-2c32887fc62b4016b6ff03f982968b76"
API_URL = "https://api.deepseek.com/v1/chat/completions"
OUTPUT_FILE = "/home/z/my-project/research/deepseek_orchestration/power_analysis_results.json"

# Quality baselines
BASELINES = {
    "total_power_w": 5.0,
    "dynamic_power_w": 3.5,
    "leakage_power_w": 1.5,
    "ir_drop_mv": 50.0
}

# Chip parameters
CHIP_PARAMS = """
- 32x32 PE systolic array (1024 PEs)
- 28nm CMOS technology
- 5W total power budget
- 1GHz operating frequency
- Supply: 1.0V core, 1.8V I/O
- Activity factor: 0.3 average, 0.8 peak
"""

# All 80 simulation prompts
SIMULATION_PROMPTS = [
    # Category 1: Dynamic Power PE Array (8)
    ("DP_PE_001", "dynamic_power_pe_array", f"Calculate dynamic power for PE array during matrix multiplication. {CHIP_PARAMS} Standard 32x32 matrix with 0.3 activity. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_002", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} Peak activity 0.8. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_003", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} Sparse matrix 0.15 activity. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_004", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} INT8 quantized ops. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_005", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} Batch processing 0.5 activity. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_006", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} Mixed precision FP16/INT8. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_007", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} Low-power 500MHz mode. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DP_PE_008", "dynamic_power_pe_array", f"Calculate dynamic power for PE array. {CHIP_PARAMS} Turbo 1.2GHz mode. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 2: IR Drop Analysis (8)
    ("IR_001", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} Uniform current distribution. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_002", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} Corner PE cluster activity. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_003", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} Center PE hotspot 0.9 activity. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_004", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} Power gating inrush current. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_005", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} Mesh grid 5mOhm/sq. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_006", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} 16 sleep regions. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_007", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} Simultaneous switching noise. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IR_008", "ir_drop_analysis", f"Analyze IR drop across power grid. {CHIP_PARAMS} EM-aware at 85C. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 3: Leakage Power Estimation (8)
    ("LK_001", "leakage_power_estimation", f"Estimate leakage power at 85C junction. {CHIP_PARAMS} All PEs active. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_002", "leakage_power_estimation", f"Estimate leakage power at 85C junction. {CHIP_PARAMS} Sleep mode enabled. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_003", "leakage_power_estimation", f"Estimate leakage power at 105C worst-case. {CHIP_PARAMS} High temperature. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_004", "leakage_power_estimation", f"Estimate leakage power with RBB. {CHIP_PARAMS} Reverse body bias. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_005", "leakage_power_estimation", f"Estimate leakage power with High-Vt. {CHIP_PARAMS} HVT cells in non-critical. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_006", "leakage_power_estimation", f"Estimate leakage power with clock gating. {CHIP_PARAMS} Halted clock tree. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_007", "leakage_power_estimation", f"Estimate leakage power partial. {CHIP_PARAMS} 256 PEs standby. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("LK_008", "leakage_power_estimation", f"Estimate GIDL contribution. {CHIP_PARAMS} Gate-induced drain leakage. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 4: Power Gating Strategy (8)
    ("PG_001", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} 16 sleep regions coarse-grain. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_002", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} Fine-grain per PE column. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_003", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} Header switch PMOS. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_004", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} Retention registers. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_005", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} Drowsy mode 0.7V. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_006", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} Sequential wake-up. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_007", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} SRAM array with retention. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PG_008", "power_gating_strategy", f"Design power gating strategy. {CHIP_PARAMS} Activity prediction controller. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 5: Clock Tree Power (8)
    ("CT_001", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} H-tree 1024 destinations. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_002", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} Mesh network. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_003", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} 32 clock domains. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_004", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} Multi-level gating. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_005", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} Low-swing Vdd/2. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_006", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} Resonant clock. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_007", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} Buffer sizing optimization. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("CT_008", "clock_tree_power", f"Calculate clock tree power. {CHIP_PARAMS} PLL and clock generation. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 6: Decoupling Capacitor (8)
    ("DC_001", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} 100ps transients. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_002", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} 10ns package decap. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_003", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} MOS vs MIM decap. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_004", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} Target impedance 5W. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_005", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} PDN resonance. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_006", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} Power gating ripple. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_007", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} Area-constrained placement. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("DC_008", "decoupling_capacitor", f"Analyze decoupling capacitor requirements. {CHIP_PARAMS} Decap leakage contribution. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 7: Inference Workload Power (8)
    ("IW_001", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} ResNet-50 batch=1. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_002", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} BERT-base transformer. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_003", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} YOLOv5 detection. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_004", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} Batch=8 processing. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_005", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} INT8 quantized. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_006", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} 50% sparsity. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_007", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} Memory vs compute bound. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("IW_008", "inference_workload_power", f"Estimate inference workload power. {CHIP_PARAMS} Continuous throughput. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 8: Short-Circuit Power (8)
    ("SC_001", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} Standard cell switching. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_002", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} Driver sizing optimization. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_003", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} Long interconnect drivers. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_004", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} Clock buffer contribution. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_005", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} Reduced Vdd impact. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_006", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} High-activity paths. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_007", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} Multi-Vt cells. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("SC_008", "short_circuit_power", f"Calculate short-circuit power. {CHIP_PARAMS} PE array combinational. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 9: Power State Transitions (8)
    ("PS_001", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Active to sleep. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_002", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Sleep to active wake-up. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_003", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Multiple idle states. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_004", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} DVFS transitions. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_005", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Frequency ramping. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_006", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Partial power gating. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_007", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Workload-driven transitions. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("PS_008", "power_state_transitions", f"Analyze power state transitions. {CHIP_PARAMS} Thermal throttling. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    
    # Category 10: Adaptive Voltage Scaling (8)
    ("AVS_001", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Closed-loop AVS. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_002", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Open-loop DVS. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_003", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Fine-grain per column. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_004", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Body biasing. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_005", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Error-detection circuit. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_006", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Temperature-aware. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_007", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Aging-aware NBTI. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
    ("AVS_008", "adaptive_voltage_scaling", f"Design adaptive voltage scaling. {CHIP_PARAMS} Workload optimization. Format: total_power_w: XW, dynamic_power_w: XW, leakage_power_w: XW, ir_drop_mv: XmV"),
]


def call_api(prompt: str) -> dict:
    """Make API call"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 1000
    }
    
    try:
        resp = requests.post(API_URL, headers=headers, json=payload, timeout=45)
        if resp.status_code == 200:
            return {"success": True, "content": resp.json()["choices"][0]["message"]["content"]}
        return {"success": False, "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)[:100]}


def extract_metrics(content: str) -> dict:
    """Extract power metrics from response"""
    metrics = {}
    
    patterns = {
        "total_power_w": r"total_power_w[:\s]*(\d+\.?\d*)\s*W",
        "dynamic_power_w": r"dynamic_power_w[:\s]*(\d+\.?\d*)\s*W",
        "leakage_power_w": r"leakage_power_w[:\s]*(\d+\.?\d*)\s*W",
        "ir_drop_mv": r"ir_drop_mv[:\s]*(\d+\.?\d*)\s*mV"
    }
    
    for metric, pattern in patterns.items():
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            try:
                metrics[metric] = float(match.group(1))
            except:
                metrics[metric] = None
        else:
            metrics[metric] = None
    
    return metrics


def calc_quality(metrics: dict) -> float:
    """Calculate quality score"""
    scores = []
    for k, baseline in BASELINES.items():
        v = metrics.get(k)
        if v is not None:
            err = abs(v - baseline) / baseline
            scores.append(max(0, 1 - err))
    return sum(scores) / len(scores) if scores else 0


def is_signal(metrics: dict) -> bool:
    """Check if result is signal vs noise"""
    for k, baseline in BASELINES.items():
        v = metrics.get(k)
        if v is not None and abs(v - baseline) / baseline < 0.3:
            return True
    return False


def main():
    print("=" * 70)
    print("Power Analysis Simulation - Mask-Locked Inference Chip")
    print("=" * 70)
    print(f"Tasks: {len(SIMULATION_PROMPTS)} | Categories: 10")
    print()
    
    results = []
    start = time.time()
    
    for i, (task_id, category, prompt) in enumerate(SIMULATION_PROMPTS):
        t0 = time.time()
        resp = call_api(prompt)
        elapsed = time.time() - t0
        
        if resp["success"]:
            metrics = extract_metrics(resp["content"])
            quality = calc_quality(metrics)
            signal = is_signal(metrics)
        else:
            metrics = {k: None for k in BASELINES.keys()}
            quality = 0
            signal = False
        
        result = {
            "task_id": task_id,
            "category": category,
            "success": resp["success"],
            "metrics": metrics,
            "quality_score": round(quality, 4),
            "is_signal": signal,
            "elapsed_s": round(elapsed, 2),
            "content": resp.get("content", "")[:300] if resp["success"] else resp.get("error", "")
        }
        results.append(result)
        
        status = "✓" if resp["success"] else "✗"
        sig = "S" if signal else "N"
        print(f"[{i+1:2d}/{len(SIMULATION_PROMPTS)}] {status} {task_id} Q={quality:.2f} {sig} {elapsed:.1f}s")
    
    total_time = time.time() - start
    
    # Calculate statistics
    total = len(results)
    success = sum(1 for r in results if r["success"])
    avg_q = sum(r["quality_score"] for r in results) / total
    signals = sum(1 for r in results if r["is_signal"])
    
    # Category breakdown
    cats = {}
    for r in results:
        c = r["category"]
        if c not in cats:
            cats[c] = {"count": 0, "success": 0, "signals": 0, "quality": 0}
        cats[c]["count"] += 1
        cats[c]["success"] += r["success"]
        cats[c]["signals"] += r["is_signal"]
        cats[c]["quality"] += r["quality_score"]
    
    for c in cats:
        cats[c]["avg_quality"] = round(cats[c]["quality"] / cats[c]["count"], 4)
    
    # Metric averages
    metric_stats = {}
    for m in BASELINES.keys():
        vals = [r["metrics"][m] for r in results if r["metrics"].get(m) is not None]
        if vals:
            metric_stats[m] = {"avg": round(sum(vals)/len(vals), 2), "min": min(vals), "max": max(vals), "n": len(vals)}
    
    # Key findings
    findings = []
    
    dp_vals = [r["metrics"]["dynamic_power_w"] for r in results if r["category"] == "dynamic_power_pe_array" and r["metrics"].get("dynamic_power_w")]
    if dp_vals:
        findings.append(f"Dynamic power: {min(dp_vals):.2f}W - {max(dp_vals):.2f}W (baseline 3.5W)")
    
    ir_vals = [r["metrics"]["ir_drop_mv"] for r in results if r["category"] == "ir_drop_analysis" and r["metrics"].get("ir_drop_mv")]
    if ir_vals:
        findings.append(f"IR drop: {min(ir_vals):.1f}mV - {max(ir_vals):.1f}mV (baseline 50mV)")
    
    lk_vals = [r["metrics"]["leakage_power_w"] for r in results if r["category"] == "leakage_power_estimation" and r["metrics"].get("leakage_power_w")]
    if lk_vals:
        findings.append(f"Leakage: {min(lk_vals):.2f}W - {max(lk_vals):.2f}W (baseline 1.5W)")
    
    total_vals = [r["metrics"]["total_power_w"] for r in results if r["metrics"].get("total_power_w")]
    if total_vals:
        findings.append(f"Total power: {min(total_vals):.2f}W - {max(total_vals):.2f}W (baseline 5.0W)")
    
    # Save results
    output = {
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "total_time_s": round(total_time, 2),
            "api_url": API_URL,
            "model": "deepseek-chat"
        },
        "summary": {
            "total_calls": total,
            "successful_calls": success,
            "success_rate": round(success/total, 4),
            "average_quality_score": round(avg_q, 4),
            "signal_count": signals,
            "signal_ratio": round(signals/total, 4)
        },
        "baselines": BASELINES,
        "metric_statistics": metric_stats,
        "category_breakdown": cats,
        "key_findings": findings,
        "results": results
    }
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2)
    
    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total calls: {total}")
    print(f"Successful: {success} ({success/total*100:.1f}%)")
    print(f"Average quality: {avg_q:.4f}")
    print(f"Signal ratio: {signals}/{total} ({signals/total*100:.1f}%)")
    print(f"Total time: {total_time:.1f}s ({total_time/total:.2f}s/call)")
    print()
    print("Key Findings:")
    for f in findings:
        print(f"  • {f}")
    print()
    print(f"Results saved: {OUTPUT_FILE}")
    print("=" * 70)
    
    return output


if __name__ == "__main__":
    main()
