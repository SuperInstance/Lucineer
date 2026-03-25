"""
ClawBench — HTML Report Generator

Generates interactive HTML reports with Chart.js visualizations
for benchmark results. Supports single-platform and comparison views.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


@dataclass
class BenchmarkResult:
    """Results from a single benchmark run."""
    model_name: str
    platform: str
    profile: str
    tokens_per_second: float
    first_token_latency_ms: float
    per_token_latency_ms: float
    power_average_w: float
    power_peak_w: float
    energy_per_token_mj: float
    utilization_lut_pct: float
    utilization_dsp_pct: float
    timing_mhz: float
    timestamp: str


def generate_html_report(
    results: list[BenchmarkResult],
    title: str = "ClawBench Report",
    output_path: Optional[str] = None,
) -> str:
    """Generate an interactive HTML report with charts."""

    models = [r.model_name for r in results]
    platforms = list(set(r.platform for r in results))
    is_comparison = len(platforms) > 1

    # Group results by platform
    by_platform: dict[str, list[BenchmarkResult]] = {}
    for r in results:
        by_platform.setdefault(r.platform, []).append(r)

    # Chart data
    throughput_data = json.dumps({
        "labels": models,
        "datasets": [
            {
                "label": platform,
                "data": [
                    next((r.tokens_per_second for r in runs if r.model_name == m), 0)
                    for m in models
                ],
                "backgroundColor": color,
            }
            for (platform, runs), color in zip(
                by_platform.items(),
                ["rgba(74, 144, 226, 0.8)", "rgba(80, 200, 120, 0.8)",
                 "rgba(255, 107, 53, 0.8)", "rgba(155, 89, 182, 0.8)"]
            )
        ]
    })

    power_data = json.dumps({
        "labels": models,
        "datasets": [
            {
                "label": platform,
                "data": [
                    next((r.power_average_w for r in runs if r.model_name == m), 0)
                    for m in models
                ],
                "backgroundColor": color,
            }
            for (platform, runs), color in zip(
                by_platform.items(),
                ["rgba(74, 144, 226, 0.8)", "rgba(80, 200, 120, 0.8)",
                 "rgba(255, 107, 53, 0.8)", "rgba(155, 89, 182, 0.8)"]
            )
        ]
    })

    efficiency_data = json.dumps({
        "labels": models,
        "datasets": [
            {
                "label": platform,
                "data": [
                    round(
                        next((r.tokens_per_second for r in runs if r.model_name == m), 0)
                        / max(next((r.power_average_w for r in runs if r.model_name == m), 1), 0.01),
                        1
                    )
                    for m in models
                ],
                "backgroundColor": color,
            }
            for (platform, runs), color in zip(
                by_platform.items(),
                ["rgba(74, 144, 226, 0.8)", "rgba(80, 200, 120, 0.8)",
                 "rgba(255, 107, 53, 0.8)", "rgba(155, 89, 182, 0.8)"]
            )
        ]
    })

    # Results table rows
    table_rows = ""
    for r in results:
        tok_per_watt = r.tokens_per_second / max(r.power_average_w, 0.01)
        dsp_class = "highlight-zero" if r.utilization_dsp_pct == 0 else "highlight-warn"
        table_rows += f"""
        <tr>
            <td>{r.model_name}</td>
            <td>{r.platform}</td>
            <td class="numeric">{r.tokens_per_second:,.1f}</td>
            <td class="numeric">{r.first_token_latency_ms:.1f}</td>
            <td class="numeric">{r.per_token_latency_ms:.1f}</td>
            <td class="numeric">{r.power_average_w:.2f}</td>
            <td class="numeric">{r.energy_per_token_mj:.2f}</td>
            <td class="numeric">{tok_per_watt:,.1f}</td>
            <td class="numeric">{r.utilization_lut_pct:.1f}%</td>
            <td class="numeric {dsp_class}">{r.utilization_dsp_pct:.1f}%</td>
            <td class="numeric">{r.timing_mhz:.0f}</td>
        </tr>"""

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
    <style>
        :root {{
            --bg: #0d1117;
            --surface: #161b22;
            --border: #30363d;
            --text: #c9d1d9;
            --accent: #58a6ff;
            --green: #3fb950;
            --red: #f85149;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 20px;
        }}
        h1 {{ color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 10px; }}
        h2 {{ color: var(--text); margin-top: 40px; }}
        .meta {{ color: #8b949e; font-size: 0.9em; margin-bottom: 30px; }}
        .charts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }}
        .chart-container {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
        }}
        .chart-container.full {{ grid-column: 1 / -1; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            background: var(--surface);
            border-radius: 8px;
            overflow: hidden;
            margin: 20px 0;
        }}
        th {{
            background: #21262d;
            padding: 12px 16px;
            text-align: left;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8b949e;
        }}
        td {{
            padding: 10px 16px;
            border-top: 1px solid var(--border);
        }}
        .numeric {{ text-align: right; font-family: monospace; }}
        .highlight-zero {{ color: var(--green); font-weight: bold; }}
        .highlight-warn {{ color: var(--red); }}
        .badge {{
            display: inline-block;
            background: var(--accent);
            color: var(--bg);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
        }}
        .footer {{ margin-top: 40px; color: #8b949e; font-size: 0.8em; text-align: center; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="meta">
        Platform{'s' if is_comparison else ''}: {', '.join(platforms)} |
        Models: {len(models)} |
        Generated: {now} |
        <span class="badge">MLS v1.0</span>
        <span class="badge">DSP: 0%</span>
    </div>

    <div class="charts">
        <div class="chart-container">
            <h3>Throughput (tokens/second)</h3>
            <canvas id="throughputChart"></canvas>
        </div>
        <div class="chart-container">
            <h3>Power Consumption (watts)</h3>
            <canvas id="powerChart"></canvas>
        </div>
        <div class="chart-container full">
            <h3>Efficiency (tokens/watt)</h3>
            <canvas id="efficiencyChart"></canvas>
        </div>
    </div>

    <h2>Detailed Results</h2>
    <table>
        <thead>
            <tr>
                <th>Model</th>
                <th>Platform</th>
                <th>Tok/s</th>
                <th>First (ms)</th>
                <th>Per-tok (ms)</th>
                <th>Power (W)</th>
                <th>Energy (mJ/tok)</th>
                <th>Tok/W</th>
                <th>LUT %</th>
                <th>DSP %</th>
                <th>MHz</th>
            </tr>
        </thead>
        <tbody>{table_rows}
        </tbody>
    </table>

    <div class="footer">
        Generated by ClawBench v1.0 | Mask-Lock Standard Project |
        All models quantized to ternary (1.58-bit) | DSP usage should be 0%
    </div>

    <script>
        const chartOptions = {{
            responsive: true,
            plugins: {{ legend: {{ labels: {{ color: '#c9d1d9' }} }} }},
            scales: {{
                x: {{ ticks: {{ color: '#8b949e' }}, grid: {{ color: '#30363d' }} }},
                y: {{ ticks: {{ color: '#8b949e' }}, grid: {{ color: '#30363d' }}, beginAtZero: true }}
            }}
        }};

        new Chart(document.getElementById('throughputChart'), {{
            type: 'bar',
            data: {throughput_data},
            options: {{ ...chartOptions }}
        }});

        new Chart(document.getElementById('powerChart'), {{
            type: 'bar',
            data: {power_data},
            options: {{ ...chartOptions }}
        }});

        new Chart(document.getElementById('efficiencyChart'), {{
            type: 'bar',
            data: {efficiency_data},
            options: {{ ...chartOptions }}
        }});
    </script>
</body>
</html>"""

    if output_path:
        Path(output_path).write_text(html)

    return html
