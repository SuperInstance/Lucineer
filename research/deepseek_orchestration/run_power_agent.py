#!/usr/bin/env python3
"""
DeepSeek Simulation Runner - Power Analysis Domain
Specialized agent for dynamic/static power, IR drop, power gating
"""

import os
import sys
import json
import time
import asyncio
import aiohttp
from datetime import datetime
from typing import Dict, List, Tuple
import statistics
import re

DEEPSEEK_API_KEY = "sk-2c32887fc62b4016b6ff03f982968b76"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1/chat/completions"

class PowerAnalysisAgent:
    def __init__(self):
        self.agent_id = "power_analysis_executor"
        self.domain = "power_analysis"
        self.calls_made = 0
        self.results = []
        self.session = None
        
        self.baselines = {
            "total_power_w": 5.0,
            "dynamic_power_w": 3.5,
            "leakage_power_w": 1.5,
            "ir_drop_mv": 50,
            "peak_current_ma": 2000,
            "power_efficiency": 0.85
        }
        
        self.simulation_tasks = [
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
        ]

    async def call_deepseek(self, prompt: str, max_tokens: int = 4096) -> Tuple[str, int]:
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        system_prompt = """You are a power analysis specialist for ASIC design. Expertise includes:
        - Dynamic power calculation (P = αCV²f)
        - Static/leakage power estimation
        - IR drop analysis and power grid design
        - Power gating and retention strategies
        - Clock tree power optimization
        - Low-power design techniques
        
        Provide numerical results in JSON format:
        {
            "total_power_w": <value>,
            "dynamic_power_w": <value>,
            "leakage_power_w": <value>,
            "ir_drop_mv": <value>,
            "analysis": "<text>",
            "recommendations": ["<rec1>", "<rec2>"]
        }
        
        Target: 28nm technology, 5W power budget, 1GHz operation
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
            async with self.session.post(DEEPSEEK_BASE_URL, headers=headers, json=payload, timeout=60) as response:
                if response.status == 200:
                    data = await response.json()
                    content = data["choices"][0]["message"]["content"]
                    tokens = data.get("usage", {}).get("total_tokens", 0)
                    self.calls_made += 1
                    return content, tokens
                else:
                    return f"Error: {response.status}", 0
        except Exception as e:
            return f"Exception: {str(e)}", 0

    async def run_simulation(self, task: str, cycle: int) -> Dict:
        prompt = f"""
        POWER ANALYSIS SIMULATION - Cycle {cycle}
        Task: {task}
        
        Chip Parameters:
        - 32x32 PE array, 28nm technology
        - Supply voltage: 1.0V core, 1.8V I/O
        - Operating frequency: 1GHz
        - Activity factor: 0.3 average, 0.8 peak
        - Gate capacitance: 1.2 fF/μm (28nm)
        - Temperature: 85C junction
        
        Power grid parameters:
        - Metal layers: M1-M8 for power
        - Grid pitch: 20μm
        - Via resistance: 0.1Ω per via
        
        Provide detailed power analysis with numerical breakdown.
        Output metrics in JSON format.
        """
        
        result, tokens = await self.call_deepseek(prompt)
        metrics = self._parse_metrics(result)
        quality = self._calculate_quality(metrics)
        
        return {
            "cycle": cycle,
            "task": task,
            "metrics": metrics,
            "quality_score": quality,
            "raw_result": result[:1500],
            "tokens": tokens
        }

    def _parse_metrics(self, result: str) -> Dict:
        metrics = {}
        json_pattern = r'\{[^{}]*\}'
        for match in re.finditer(json_pattern, result, re.DOTALL):
            try:
                parsed = json.loads(match.group())
                for k, v in parsed.items():
                    if isinstance(v, (int, float)):
                        metrics[k] = float(v)
            except:
                pass
        return metrics

    def _calculate_quality(self, metrics: Dict) -> float:
        if not metrics:
            return 0.5
        scores = []
        for key, baseline in self.baselines.items():
            if key in metrics:
                actual = metrics[key]
                if actual <= baseline:
                    scores.append(1.0)
                else:
                    scores.append(max(0, 1 - (actual - baseline) / baseline))
        return statistics.mean(scores) if scores else 0.5

    async def run_continuous_simulations(self, num_simulations: int = 100):
        print(f"[{self.agent_id}] Starting {num_simulations} power simulations...")
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            
            for i in range(num_simulations):
                task_idx = i % len(self.simulation_tasks)
                task = self.simulation_tasks[task_idx]
                
                result = await self.run_simulation(task, i)
                self.results.append(result)
                
                if (i + 1) % 10 == 0:
                    avg_q = statistics.mean([r["quality_score"] for r in self.results])
                    print(f"[{self.agent_id}] Progress: {i+1}/{num_simulations}, Quality: {avg_q:.2f}")
                
                await asyncio.sleep(0.2)
        
        return self.results

    def generate_summary(self) -> Dict:
        if not self.results:
            return {}
        
        all_metrics = {}
        for r in self.results:
            for k, v in r["metrics"].items():
                if k not in all_metrics:
                    all_metrics[k] = []
                all_metrics[k].append(v)
        
        return {
            "domain": self.domain,
            "total_simulations": len(self.results),
            "total_calls": self.calls_made,
            "average_quality": statistics.mean([r["quality_score"] for r in self.results]),
            "metrics_summary": {
                k: {"mean": statistics.mean(v), "min": min(v), "max": max(v)}
                for k, v in all_metrics.items() if v
            }
        }


async def main():
    agent = PowerAnalysisAgent()
    results = await agent.run_continuous_simulations(num_simulations=100)
    summary = agent.generate_summary()
    
    output_dir = "/home/z/my-project/research/deepseek_orchestration"
    os.makedirs(output_dir, exist_ok=True)
    
    with open(f"{output_dir}/power_analysis_results.json", "w") as f:
        json.dump({"summary": summary, "results": results[-20:]}, f, indent=2, default=str)
    
    print(f"\n[{agent.agent_id}] Complete: {agent.calls_made} calls")
    return summary


if __name__ == "__main__":
    asyncio.run(main())
