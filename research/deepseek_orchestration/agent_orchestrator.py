#!/usr/bin/env python3
"""
Professional Multi-Agent Orchestration System for Mask-Locked Inference Chip
DeepSeek + GLM-5 Synergistic Architecture

Architecture:
- DeepSeek: Execution engine (simulations, code generation, numerical analysis)
- GLM-5: Research engine (domain study, synthesis, quality control)

Specialized Agents (12 Narrow Expertise Domains):
1. Thermal Physics Engineer - heat dissipation, thermal modeling
2. VLSI Layout Specialist - floorplanning, routing, area optimization
3. Power Analysis Engineer - dynamic/static power, IR drop
4. Timing Closure Expert - STA, clock tree synthesis
5. Memory Architecture Designer - SRAM, cache hierarchy
6. Neuromorphic Computing Specialist - spike-based computing
7. Verification Engineer - testbenches, coverage, formal methods
8. Reliability Engineer - aging, ESD, soft errors
9. Signal Integrity Analyst - crosstalk, EM, SSO
10. Process Variation Specialist - PVT corners, statistical design
11. System Integration Engineer - NoC, interconnects, protocols
12. Machine Learning Hardware Specialist - quantization, pruning hardware
"""

import os
import sys
import json
import time
import asyncio
import aiohttp
import hashlib
import statistics
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import threading
from queue import Queue
import traceback
import re

# API Configuration
DEEPSEEK_API_KEY = "sk-2c32887fc62b4016b6ff03f982968b76"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1/chat/completions"
GLM5_BASE_URL = "http://localhost:3000/api/chat"

# Track API usage
api_usage = {
    "deepseek_calls": 0,
    "deepseek_tokens": 0,
    "deepseek_cost": 0.0,
    "glm5_calls": 0,
    "glm5_tokens": 0,
    "start_time": None
}

# Evidence tracking for signal vs noise detection
@dataclass
class Evidence:
    metric_name: str
    value: float
    timestamp: datetime
    agent_id: str
    confidence: float
    source: str  # 'deepseek' or 'glm5'

@dataclass
class SimulationResult:
    cycle_id: int
    agent_id: str
    domain: str
    result_data: Dict
    quality_score: float
    evidence_list: List[Evidence]
    improvement_delta: float = 0.0
    is_signal: bool = True

class AgentType(Enum):
    DEEPSEEK_EXECUTOR = "deepseek_executor"
    GLM5_RESEARCHER = "glm5_researcher"

@dataclass
class SpecializedAgent:
    agent_id: str
    domain: str
    expertise: str
    agent_type: AgentType
    study_context: str = ""
    successful_patterns: List[str] = field(default_factory=list)
    failed_patterns: List[str] = field(default_factory=list)
    calls_made: int = 0
    quality_history: List[float] = field(default_factory=list)

# Domain-specific expertise definitions
DOMAIN_EXPERTISE = {
    "thermal_physics": {
        "focus": "Heat dissipation, thermal modeling, cooling solutions",
        "deepseek_tasks": ["run_thermal_simulation", "calculate_thermal_resistance", "optimize_heatsink", "analyze_hotspots"],
        "glm5_tasks": ["research_thermal_materials", "study_thermal_physics_theory", "synthesize_cooling_strategies"],
        "key_metrics": ["junction_temperature", "thermal_resistance", "power_density", "hotspot_temperature"],
        "baseline_values": {"junction_temp_c": 85, "thermal_resistance_cw": 0.5, "power_density_wmm2": 0.3}
    },
    "vlsi_layout": {
        "focus": "Floorplanning, routing, area optimization, placement",
        "deepseek_tasks": ["generate_placement", "route_optimization", "calculate_area_efficiency", "analyze_congestion"],
        "glm5_tasks": ["research_layout_techniques", "study_28nm_design_rules", "analyze_area_tradeoffs"],
        "key_metrics": ["area_um2", "routing_congestion", "placement_density", "wirelength"],
        "baseline_values": {"area_mm2": 25, "routing_congestion": 0.7, "wirelength_mm": 150}
    },
    "power_analysis": {
        "focus": "Dynamic/static power, IR drop, power gating",
        "deepseek_tasks": ["calculate_dynamic_power", "analyze_ir_drop", "optimize_power_gating", "estimate_leakage"],
        "glm5_tasks": ["research_low_power_techniques", "study_leakage_mechanisms", "synthesize_power_strategies"],
        "key_metrics": ["total_power_w", "dynamic_power_w", "leakage_power_w", "ir_drop_mv"],
        "baseline_values": {"total_power_w": 5.0, "dynamic_power_w": 3.5, "leakage_power_w": 1.5, "ir_drop_mv": 50}
    },
    "timing_closure": {
        "focus": "STA, clock tree synthesis, timing optimization",
        "deepseek_tasks": ["run_sta", "optimize_clock_tree", "analyze_timing_paths", "calculate_slack"],
        "glm5_tasks": ["research_timing_algorithms", "study_ose_methodology", "analyze_timing_ecos"],
        "key_metrics": ["setup_slack_ps", "hold_slack_ps", "clock_skew_ps", "timing_score"],
        "baseline_values": {"setup_slack_ps": 100, "hold_slack_ps": 50, "clock_skew_ps": 20}
    },
    "memory_architecture": {
        "focus": "SRAM design, cache hierarchy, memory bandwidth",
        "deepseek_tasks": ["design_sram_array", "calculate_bandwidth", "optimize_cache_hierarchy", "analyze_latency"],
        "glm5_tasks": ["research_memory_technologies", "study_replacement_policies", "analyze_bandwidth_bottlenecks"],
        "key_metrics": ["sram_size_kb", "bandwidth_gbps", "latency_cycles", "hit_rate"],
        "baseline_values": {"sram_size_kb": 256, "bandwidth_gbps": 128, "latency_cycles": 3, "hit_rate": 0.95}
    },
    "neuromorphic_computing": {
        "focus": "Spike-based computing, synaptic plasticity, event-driven",
        "deepseek_tasks": ["simulate_spike_network", "design_synapse_circuit", "analyze_spike_timing", "optimize_energy"],
        "glm5_tasks": ["research_neuromorphic_theory", "study_brain_inspired_architectures", "synthesize_spike_algorithms"],
        "key_metrics": ["spike_rate_hz", "synaptic_density", "energy_per_spike_pj", "learning_rate"],
        "baseline_values": {"spike_rate_hz": 1000, "synaptic_density": 1e6, "energy_per_spike_pj": 10}
    },
    "verification": {
        "focus": "Testbenches, coverage, formal methods, assertion-based",
        "deepseek_tasks": ["generate_testbench", "run_coverage_analysis", "create_assertions", "verify_protocol"],
        "glm5_tasks": ["research_verification_methodologies", "study_coverage_models", "analyze_corner_cases"],
        "key_metrics": ["code_coverage_pct", "functional_coverage_pct", "bug_detection_rate", "assertion_coverage"],
        "baseline_values": {"code_coverage_pct": 95, "functional_coverage_pct": 90}
    },
    "reliability": {
        "focus": "Aging, ESD, soft errors, MTBF analysis",
        "deepseek_tasks": ["calculate_mtbf", "analyze_aging_effects", "simulate_soft_errors", "estimate_lifetime"],
        "glm5_tasks": ["research_reliability_physics", "study_failure_mechanisms", "synthesize_mitigation_strategies"],
        "key_metrics": ["mtbf_hours", "esd_threshold_v", "soft_error_rate", "aging_degradation_pct"],
        "baseline_values": {"mtbf_hours": 100000, "esd_threshold_v": 2000, "soft_error_rate": 1e-12}
    },
    "signal_integrity": {
        "focus": "Crosstalk, EM analysis, SSO, power integrity",
        "deepseek_tasks": ["analyze_crosstalk", "simulate_em_effects", "calculate_sso_noise", "check_pi"],
        "glm5_tasks": ["research_si_fundamentals", "study_em_modeling", "analyze_pi_effects"],
        "key_metrics": ["crosstalk_mv", "em_violations", "sso_noise_mv", "supply_noise_mv"],
        "baseline_values": {"crosstalk_mv": 50, "em_violations": 0, "sso_noise_mv": 100}
    },
    "process_variation": {
        "focus": "PVT corners, statistical design, Monte Carlo",
        "deepseek_tasks": ["run_monte_carlo", "analyze_pvt_corners", "calculate_yield", "optimize_corners"],
        "glm5_tasks": ["research_variation_sources", "study_statistical_methods", "analyze_yield_models"],
        "key_metrics": ["yield_pct", "sigma_variation", "pvt_coverage", "sensitivity_score"],
        "baseline_values": {"yield_pct": 99.5, "sigma_variation": 0.1, "pvt_coverage": 100}
    },
    "system_integration": {
        "focus": "NoC design, interconnects, protocols, arbitration",
        "deepseek_tasks": ["design_noc_topology", "simulate_arbitration", "analyze_bandwidth", "optimize_latency"],
        "glm5_tasks": ["research_interconnect_architectures", "study_protocol_standards", "analyze_bottlenecks"],
        "key_metrics": ["noc_latency_cycles", "bandwidth_utilization_pct", "packet_loss_rate", "arbitration_fairness"],
        "baseline_values": {"noc_latency_cycles": 10, "bandwidth_utilization_pct": 80, "packet_loss_rate": 0}
    },
    "ml_hardware": {
        "focus": "Quantization, pruning hardware, accelerator design",
        "deepseek_tasks": ["design_quantizer", "implement_pruning_engine", "simulate_inference", "optimize_throughput"],
        "glm5_tasks": ["research_quantization_theory", "study_pruning_algorithms", "analyze_accuracy_tradeoffs"],
        "key_metrics": ["quantization_error", "pruning_ratio", "inference_latency_us", "accuracy_loss_pct"],
        "baseline_values": {"quantization_error": 0.01, "pruning_ratio": 0.5, "inference_latency_us": 100, "accuracy_loss_pct": 1.0}
    }
}

class MultiAgentOrchestrator:
    def __init__(self, target_deepseek_calls: int = 2000, budget_limit: float = 7.0):
        self.agents: Dict[str, SpecializedAgent] = {}
        self.simulation_history: List[SimulationResult] = []
        self.evidence_registry: Dict[str, List[Evidence]] = {}
        self.quality_trends: Dict[str, List[float]] = {}
        self.convergence_metrics: Dict[str, float] = {}
        
        self.target_deepseek_calls = target_deepseek_calls
        self.budget_limit = budget_limit
        self.current_cycle = 15
        self.max_cycles = 50
        
        self.session = None
        self.lock = threading.Lock()
        
        self._initialize_agents()
        
    def _initialize_agents(self):
        """Create specialized agents for each domain"""
        for domain, expertise in DOMAIN_EXPERTISE.items():
            ds_agent = SpecializedAgent(
                agent_id=f"{domain}_ds_executor",
                domain=domain,
                expertise=expertise["focus"],
                agent_type=AgentType.DEEPSEEK_EXECUTOR
            )
            
            glm5_agent = SpecializedAgent(
                agent_id=f"{domain}_glm5_researcher",
                domain=domain,
                expertise=expertise["focus"],
                agent_type=AgentType.GLM5_RESEARCHER
            )
            
            self.agents[ds_agent.agent_id] = ds_agent
            self.agents[glm5_agent.agent_id] = glm5_agent
            
        print(f"Initialized {len(self.agents)} specialized agents across {len(DOMAIN_EXPERTISE)} domains")

    async def call_deepseek(self, prompt: str, agent_id: str, max_tokens: int = 4096) -> Tuple[str, int]:
        """Execute DeepSeek API call with tracking"""
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        agent = self.agents.get(agent_id)
        system_prompt = f"You are a specialized {agent.expertise if agent else 'hardware engineer'}. Provide precise, technical, and actionable responses. Focus on numerical results and specific recommendations. Output metrics as JSON format when possible."
        
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
                    tokens_used = data.get("usage", {}).get("total_tokens", len(prompt) + len(content))
                    
                    with self.lock:
                        api_usage["deepseek_calls"] += 1
                        api_usage["deepseek_tokens"] += tokens_used
                        api_usage["deepseek_cost"] += tokens_used * 0.0002 / 1000
                        
                    if agent_id in self.agents:
                        self.agents[agent_id].calls_made += 1
                    
                    return content, tokens_used
                else:
                    error_text = await response.text()
                    print(f"DeepSeek API error: {response.status} - {error_text[:200]}")
                    return f"Error: {response.status}", 0
        except asyncio.TimeoutError:
            print(f"DeepSeek timeout for {agent_id}")
            return "Timeout", 0
        except Exception as e:
            print(f"DeepSeek call failed: {e}")
            return f"Exception: {str(e)}", 0

    async def call_glm5(self, prompt: str, agent_id: str) -> Tuple[str, int]:
        """Execute GLM-5 API call through local endpoint"""
        agent = self.agents.get(agent_id)
        system_prompt = f"You are a research specialist in {agent.expertise if agent else 'hardware engineering'}. Provide comprehensive research insights, theoretical foundations, and synthesis of complex topics."
        
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 4096,
            "temperature": 0.8
        }
        
        try:
            async with self.session.post(GLM5_BASE_URL, json=payload, timeout=120) as response:
                if response.status == 200:
                    data = await response.json()
                    content = data.get("content", "")
                    tokens_used = len(prompt) + len(content)
                    
                    with self.lock:
                        api_usage["glm5_calls"] += 1
                        api_usage["glm5_tokens"] += tokens_used
                    
                    if agent_id in self.agents:
                        self.agents[agent_id].calls_made += 1
                    
                    return content, tokens_used
                else:
                    return f"Error: {response.status}", 0
        except Exception as e:
            print(f"GLM-5 call failed: {e}")
            return f"Exception: {str(e)}", 0

    def detect_signal_vs_noise(self, metric_name: str, values: List[float]) -> Tuple[bool, float]:
        """Determine if the metric is showing meaningful signal or noise"""
        if len(values) < 3:
            return True, 0.5
        
        recent = values[-5:] if len(values) >= 5 else values
        
        variance = statistics.variance(values) if len(values) > 1 else 0
        mean = statistics.mean(values)
        cv = abs(variance / mean) if mean != 0 else 0
        
        is_signal = cv < 0.5
        
        if len(values) >= 3:
            improvements = sum(1 for i in range(1, len(values)) if values[i] <= values[i-1] * 1.1)
            improvement_ratio = improvements / (len(values) - 1)
            is_signal = is_signal and improvement_ratio > 0.6
        
        confidence = 1.0 - cv if is_signal else cv
        return is_signal, confidence

    def calculate_quality_score(self, result: Dict, domain: str) -> float:
        """Calculate quality score for a simulation result"""
        if domain not in DOMAIN_EXPERTISE:
            return 0.5
        
        domain_info = DOMAIN_EXPERTISE[domain]
        baselines = domain_info["baseline_values"]
        
        score = 0.0
        count = 0
        
        for metric, baseline in baselines.items():
            if metric in result:
                actual = result[metric]
                if actual < baseline:
                    score += min(1.0, baseline / max(actual, 0.001))
                else:
                    score += max(0, 1 - (actual - baseline) / baseline)
                count += 1
        
        return score / count if count > 0 else 0.5

    async def pre_study_domain(self, agent_id: str):
        """GLM-5 researcher pre-studies domain before execution"""
        if agent_id not in self.agents:
            return
        
        agent = self.agents[agent_id]
        domain = agent.domain
        
        study_prompt = f"""
        As a specialized researcher in {agent.expertise}, provide a comprehensive pre-study for:
        
        DOMAIN: {domain}
        FOCUS: {DOMAIN_EXPERTISE[domain]['focus']}
        
        Your study should cover:
        1. Theoretical foundations and first principles
        2. State-of-the-art techniques and recent advances
        3. Key parameters and their sensitivity
        4. Common pitfalls and failure modes
        5. Optimization strategies specific to 28nm ASIC design
        6. Relevant equations and models
        7. Industry best practices
        
        Format as a structured technical brief that can guide simulation and design decisions.
        Focus on actionable insights for mask-locked inference chip design.
        """
        
        study_result, _ = await self.call_glm5(study_prompt, agent_id)
        agent.study_context = study_result
        
        print(f"[{agent_id}] Domain pre-study completed ({len(study_result)} chars)")

    async def execute_specialized_task(self, agent_id: str, task: str, context: str = "") -> SimulationResult:
        """Execute a specialized task with the appropriate agent"""
        agent = self.agents[agent_id]
        domain = agent.domain
        
        if agent.agent_type == AgentType.DEEPSEEK_EXECUTOR:
            researcher_id = f"{domain}_glm5_researcher"
            research_context = ""
            if researcher_id in self.agents and self.agents[researcher_id].study_context:
                research_context = f"\n\nRESEARCH CONTEXT:\n{self.agents[researcher_id].study_context[:2000]}"
            
            patterns_context = ""
            if agent.successful_patterns:
                patterns_context = f"\n\nSUCCESSFUL PATTERNS:\n" + "\n".join(agent.successful_patterns[-3:])
            
            prompt = f"""
            Execute {task} for mask-locked inference chip design.
            
            DOMAIN: {domain}
            FOCUS: {agent.expertise}
            KEY METRICS: {DOMAIN_EXPERTISE[domain]['key_metrics']}
            BASELINE VALUES: {DOMAIN_EXPERTISE[domain]['baseline_values']}
            {research_context}
            {patterns_context}
            
            Additional Context: {context}
            
            Provide:
            1. Numerical results with units
            2. Analysis and interpretation
            3. Recommendations for improvement
            4. Potential issues or risks
            
            Format results as JSON-like key-value pairs for metrics.
            Example format:
            {{
                "metric_name": value,
                "another_metric": value
            }}
            """
            
            result, tokens = await self.call_deepseek(prompt, agent_id)
        else:
            prompt = f"""
            Research task: {task}
            
            DOMAIN: {domain}
            FOCUS: {agent.expertise}
            
            Previous study context: {agent.study_context[:1000] if agent.study_context else 'None'}
            
            Provide research findings that can guide design decisions.
            Include theoretical analysis, references to relevant work, and actionable insights.
            """
            
            result, tokens = await self.call_glm5(prompt, agent_id)
        
        metrics = self._extract_metrics(result, domain)
        quality_score = self.calculate_quality_score(metrics, domain)
        
        evidence_list = []
        for metric_name, value in metrics.items():
            evidence = Evidence(
                metric_name=metric_name,
                value=value,
                timestamp=datetime.now(),
                agent_id=agent_id,
                confidence=quality_score,
                source="deepseek" if agent.agent_type == AgentType.DEEPSEEK_EXECUTOR else "glm5"
            )
            evidence_list.append(evidence)
            
            if metric_name not in self.evidence_registry:
                self.evidence_registry[metric_name] = []
            self.evidence_registry[metric_name].append(evidence)
            
            if metric_name not in self.quality_trends:
                self.quality_trends[metric_name] = []
            self.quality_trends[metric_name].append(value)
        
        improvement_delta = 0.0
        if agent.quality_history:
            improvement_delta = quality_score - agent.quality_history[-1]
        
        agent.quality_history.append(quality_score)
        
        is_signal = True
        if len(agent.quality_history) >= 3:
            is_signal, _ = self.detect_signal_vs_noise(f"{agent_id}_quality", agent.quality_history)
        
        if quality_score > 0.7:
            agent.successful_patterns.append(f"Task: {task}, Score: {quality_score:.2f}")
        elif quality_score < 0.3:
            agent.failed_patterns.append(f"Task: {task}, Score: {quality_score:.2f}")
        
        return SimulationResult(
            cycle_id=self.current_cycle,
            agent_id=agent_id,
            domain=domain,
            result_data={"metrics": metrics, "raw_result": result[:2000]},
            quality_score=quality_score,
            evidence_list=evidence_list,
            improvement_delta=improvement_delta,
            is_signal=is_signal
        )

    def _extract_metrics(self, result: str, domain: str) -> Dict[str, float]:
        """Extract numerical metrics from result text"""
        metrics = {}
        domain_info = DOMAIN_EXPERTISE.get(domain, {})
        key_metrics = domain_info.get("key_metrics", [])
        
        # Try to parse JSON-like content
        json_pattern = r'\{[^{}]*\}'
        for match in re.finditer(json_pattern, result, re.DOTALL):
            try:
                json_str = match.group()
                parsed = json.loads(json_str)
                for key, value in parsed.items():
                    if isinstance(value, (int, float)):
                        metrics[key] = float(value)
            except json.JSONDecodeError:
                pass
        
        # Pattern matching for metrics
        for metric in key_metrics:
            patterns = [
                rf"{metric}[\s:]+([0-9.]+)",
                rf"{metric}.*?([0-9.]+)",
                rf'"{metric}"[\s:]+([0-9.]+)',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, result, re.IGNORECASE)
                if match:
                    try:
                        metrics[metric] = float(match.group(1))
                        break
                    except ValueError:
                        pass
        
        return metrics

    async def run_synergistic_cycle(self, cycle_id: int) -> Dict[str, SimulationResult]:
        """Run one complete synergistic cycle with GLM-5 research and DeepSeek execution"""
        results = {}
        
        print(f"\n{'='*60}")
        print(f"CYCLE {cycle_id}: Synergistic Research-Execution Cycle")
        print(f"{'='*60}")
        
        # Phase 1: GLM-5 researchers study domains in parallel
        print(f"\n[Phase 1] GLM-5 Researchers conducting domain studies...")
        research_tasks = []
        for domain in DOMAIN_EXPERTISE.keys():
            researcher_id = f"{domain}_glm5_researcher"
            if cycle_id % 5 == 0 or not self.agents[researcher_id].study_context:
                research_tasks.append(self.pre_study_domain(researcher_id))
        
        if research_tasks:
            await asyncio.gather(*research_tasks)
        
        # Phase 2: DeepSeek executors run simulations with research context
        print(f"\n[Phase 2] DeepSeek Executors running specialized simulations...")
        execution_tasks = []
        
        for domain, expertise in DOMAIN_EXPERTISE.items():
            executor_id = f"{domain}_ds_executor"
            
            task_idx = cycle_id % len(expertise["deepseek_tasks"])
            task = expertise["deepseek_tasks"][task_idx]
            
            context = ""
            if self.simulation_history:
                recent_domain_results = [r for r in self.simulation_history[-20:] if r.domain == domain]
                if recent_domain_results:
                    context = f"Previous results trend: {[r.quality_score for r in recent_domain_results]}"
            
            execution_tasks.append(self.execute_specialized_task(executor_id, task, context))
        
        execution_results = await asyncio.gather(*execution_tasks)
        
        for result in execution_results:
            results[result.agent_id] = result
            self.simulation_history.append(result)
            
            status = "SIGNAL" if result.is_signal else "NOISE"
            print(f"  [{result.agent_id}] Score: {result.quality_score:.2f} D:{result.improvement_delta:+.2f} {status}")
        
        # Phase 3: GLM-5 synthesis and quality assessment
        print(f"\n[Phase 3] GLM-5 Researchers synthesizing findings...")
        
        synthesis_tasks = []
        for domain in DOMAIN_EXPERTISE.keys():
            researcher_id = f"{domain}_glm5_researcher"
            
            domain_results = [r for r in execution_results if r.domain == domain]
            if domain_results:
                synthesis_prompt = f"""
                Synthesize the following execution results for {domain}:
                
                Results: {[r.result_data.get('metrics', {}) for r in domain_results]}
                Quality Scores: {[r.quality_score for r in domain_results]}
                
                Provide:
                1. Key findings and insights
                2. Recommendations for next cycle
                3. Potential issues to investigate
                """
                
                synthesis_tasks.append(self.call_glm5(synthesis_prompt, researcher_id))
        
        if synthesis_tasks:
            await asyncio.gather(*synthesis_tasks)
        
        return results

    async def run_continuous_cycles(self, max_cycles: int = 50):
        """Run continuous improvement cycles until convergence or budget exhausted"""
        print(f"\nStarting continuous improvement cycles...")
        print(f"Target: {self.target_deepseek_calls} DeepSeek calls")
        print(f"Budget limit: ${self.budget_limit}")
        print(f"Max cycles: {max_cycles}")
        
        api_usage["start_time"] = datetime.now()
        
        end_cycle = self.current_cycle + max_cycles
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            
            while self.current_cycle < end_cycle:
                if api_usage["deepseek_cost"] >= self.budget_limit:
                    print(f"\nBudget limit reached: ${api_usage['deepseek_cost']:.2f}")
                    break
                
                if api_usage["deepseek_calls"] >= self.target_deepseek_calls:
                    print(f"\nCall target reached: {api_usage['deepseek_calls']} calls")
                    break
                
                if self._check_convergence():
                    print(f"\nConvergence detected at cycle {self.current_cycle}")
                    break
                
                cycle_results = await self.run_synergistic_cycle(self.current_cycle)
                
                self._update_convergence_metrics()
                self._print_cycle_summary()
                
                self.current_cycle += 1
                
                await asyncio.sleep(0.3)
        
        return self.simulation_history

    def _check_convergence(self) -> bool:
        """Check if results have converged"""
        if len(self.simulation_history) < 10:
            return False
        
        recent_scores = [r.quality_score for r in self.simulation_history[-10:]]
        if len(recent_scores) >= 5:
            variance = statistics.variance(recent_scores)
            if variance < 0.001:
                return True
        
        return False

    def _update_convergence_metrics(self):
        """Update convergence tracking metrics"""
        for metric_name, values in self.quality_trends.items():
            if len(values) >= 5:
                recent = values[-5:]
                self.convergence_metrics[metric_name] = {
                    "mean": statistics.mean(recent),
                    "stdev": statistics.stdev(recent) if len(recent) > 1 else 0,
                    "trend": "improving" if recent[-1] > recent[0] else "declining"
                }

    def _print_cycle_summary(self):
        """Print summary of current progress"""
        print(f"\n{'='*60}")
        print(f"Cycle {self.current_cycle} Summary")
        print(f"{'='*60}")
        print(f"DeepSeek calls: {api_usage['deepseek_calls']} / {self.target_deepseek_calls}")
        print(f"DeepSeek cost: ${api_usage['deepseek_cost']:.4f} / ${self.budget_limit}")
        print(f"GLM-5 calls: {api_usage['glm5_calls']}")
        print(f"Total simulations: {len(self.simulation_history)}")
        
        print(f"\nDomain Quality Scores:")
        for domain in DOMAIN_EXPERTISE.keys():
            domain_results = [r for r in self.simulation_history if r.domain == domain]
            if domain_results:
                avg_score = statistics.mean([r.quality_score for r in domain_results])
                print(f"  {domain}: {avg_score:.2f} ({len(domain_results)} simulations)")
        
        signals = sum(1 for r in self.simulation_history if r.is_signal)
        noise = len(self.simulation_history) - signals
        ratio = signals/len(self.simulation_history)*100 if self.simulation_history else 0
        print(f"\nSignal/Noise: {signals}/{noise} ({ratio:.1f}% signal)")

    def generate_report(self) -> Dict:
        """Generate comprehensive report of all cycles"""
        return {
            "summary": {
                "total_cycles": self.current_cycle,
                "total_simulations": len(self.simulation_history),
                "api_usage": api_usage,
                "runtime_seconds": (datetime.now() - api_usage["start_time"]).total_seconds() if api_usage["start_time"] else 0
            },
            "domain_performance": {
                domain: {
                    "simulations": len([r for r in self.simulation_history if r.domain == domain]),
                    "avg_quality": statistics.mean([r.quality_score for r in self.simulation_history if r.domain == domain]) if any(r.domain == domain for r in self.simulation_history) else 0,
                    "convergence": self.convergence_metrics.get(domain, {})
                }
                for domain in DOMAIN_EXPERTISE.keys()
            },
            "evidence_summary": {
                metric: {
                    "count": len(evidence),
                    "avg_value": statistics.mean([e.value for e in evidence]),
                    "trend": self.quality_trends.get(metric, [])
                }
                for metric, evidence in self.evidence_registry.items()
            },
            "agent_statistics": {
                agent_id: {
                    "calls_made": agent.calls_made,
                    "quality_history": agent.quality_history[-10:] if agent.quality_history else [],
                    "successful_patterns": len(agent.successful_patterns),
                    "failed_patterns": len(agent.failed_patterns)
                }
                for agent_id, agent in self.agents.items()
            }
        }


async def main():
    """Main entry point for professional-grade simulation"""
    orchestrator = MultiAgentOrchestrator(
        target_deepseek_calls=2000,
        budget_limit=7.0
    )
    
    results = await orchestrator.run_continuous_cycles(max_cycles=50)
    report = orchestrator.generate_report()
    
    report_path = "/home/z/my-project/research/deepseek_orchestration/simulation_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\nReport saved to: {report_path}")
    return report


if __name__ == "__main__":
    asyncio.run(main())
