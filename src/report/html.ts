import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { QualityReportData, RuleHitSummary } from './aggregator.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debtVerdict(score: number): { label: string; tone: 'good' | 'ok' | 'warn' | 'bad' } {
  if (score <= 10) return { label: 'Excellent — very few issues detected.', tone: 'good' };
  if (score <= 30) return { label: 'Good — some issues but generally clean.', tone: 'ok' };
  if (score <= 60) return { label: 'Fair — significant issues need attention.', tone: 'warn' };
  return { label: 'Poor — many violations detected. Review rule configuration.', tone: 'bad' };
}

function debtColor(tone: 'good' | 'ok' | 'warn' | 'bad'): string {
  return {
    good: '#16a34a',
    ok: '#65a30d',
    warn: '#ca8a04',
    bad: '#dc2626',
  }[tone];
}

function donutSvg(blocks: number, warns: number, passes: number): string {
  const total = blocks + warns + passes;
  if (total === 0) {
    return '<svg viewBox="0 0 120 120" role="img" aria-label="No data"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" stroke-width="18"/></svg>';
  }
  const R = 48;
  const C = 2 * Math.PI * R;
  const blockLen = (blocks / total) * C;
  const warnLen = (warns / total) * C;
  const passLen = (passes / total) * C;

  const blockOffset = 0;
  const warnOffset = -blockLen;
  const passOffset = -(blockLen + warnLen);

  return `<svg viewBox="0 0 120 120" role="img" aria-label="Pass ${passes}, warn ${warns}, block ${blocks}">
    <g transform="rotate(-90 60 60)">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--border)" stroke-width="18"/>
      ${
        blocks > 0
          ? `<circle cx="60" cy="60" r="${R}" fill="none" stroke="#dc2626" stroke-width="18" stroke-dasharray="${blockLen} ${C - blockLen}" stroke-dashoffset="${blockOffset}"/>`
          : ''
      }
      ${
        warns > 0
          ? `<circle cx="60" cy="60" r="${R}" fill="none" stroke="#ca8a04" stroke-width="18" stroke-dasharray="${warnLen} ${C - warnLen}" stroke-dashoffset="${warnOffset}"/>`
          : ''
      }
      ${
        passes > 0
          ? `<circle cx="60" cy="60" r="${R}" fill="none" stroke="#16a34a" stroke-width="18" stroke-dasharray="${passLen} ${C - passLen}" stroke-dashoffset="${passOffset}"/>`
          : ''
      }
    </g>
    <text x="60" y="58" text-anchor="middle" class="donut-num">${total}</text>
    <text x="60" y="74" text-anchor="middle" class="donut-label">hits</text>
  </svg>`;
}

function barChart(ruleHits: RuleHitSummary[]): string {
  if (ruleHits.length === 0) return '';
  const top = ruleHits.slice(0, 10);
  const max = Math.max(...top.map((r) => r.totalHits), 1);

  return top
    .map((r) => {
      const blockPct = (r.blocks / max) * 100;
      const warnPct = (r.warns / max) * 100;
      const passPct = (r.passes / max) * 100;
      return `<div class="bar-row">
        <div class="bar-label" title="${escapeHtml(r.ruleId)}">${escapeHtml(r.ruleId)}</div>
        <div class="bar-track" aria-label="${r.totalHits} hits: ${r.blocks} blocks, ${r.warns} warns, ${r.passes} passes">
          <div class="bar-seg bar-block" style="width:${blockPct}%"></div>
          <div class="bar-seg bar-warn" style="width:${warnPct}%"></div>
          <div class="bar-seg bar-pass" style="width:${passPct}%"></div>
        </div>
        <div class="bar-count">${r.totalHits}</div>
      </div>`;
    })
    .join('');
}

function ruleTable(ruleHits: RuleHitSummary[]): string {
  if (ruleHits.length === 0) return '';
  const rows = ruleHits
    .map((r) => {
      const lastHit = r.lastHit ? new Date(r.lastHit).toLocaleDateString() : '—';
      return `<tr>
        <td><code>${escapeHtml(r.ruleId)}</code></td>
        <td class="num">${r.totalHits}</td>
        <td class="num ${r.blocks > 0 ? 'cell-block' : ''}">${r.blocks}</td>
        <td class="num ${r.warns > 0 ? 'cell-warn' : ''}">${r.warns}</td>
        <td class="num cell-pass">${r.passes}</td>
        <td class="cell-date">${escapeHtml(lastHit)}</td>
      </tr>`;
    })
    .join('');
  return `<table class="rule-table">
    <thead><tr>
      <th>Rule</th><th class="num">Hits</th><th class="num">Blocks</th><th class="num">Warns</th><th class="num">Passes</th><th>Last Hit</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function topBlockedList(ruleHits: RuleHitSummary[]): string {
  const top = ruleHits.filter((r) => r.blocks > 0).slice(0, 5);
  if (top.length === 0) return '<p class="muted">No blocks recorded.</p>';
  const items = top
    .map(
      (r) =>
        `<li><code>${escapeHtml(r.ruleId)}</code><span class="pill pill-block">${r.blocks} blocks</span></li>`,
    )
    .join('');
  return `<ul class="top-blocked">${items}</ul>`;
}

export function generateHtmlReport(data: QualityReportData): string {
  const generated = new Date(data.generatedAt).toLocaleString();
  const verdict = debtVerdict(data.debtScore);
  const verdictColor = debtColor(verdict.tone);
  const { blocks, warns, passes } = data.blockWarnRatio;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="generator" content="VGuard"/>
<title>VGuard Quality Report</title>
<style>
:root {
  --bg: #ffffff;
  --surface: #f8fafc;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --accent: #2563eb;
  --good: #16a34a;
  --warn: #ca8a04;
  --bad: #dc2626;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b1220;
    --surface: #121a2b;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --border: #1f2a44;
    --accent: #60a5fa;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px; line-height: 1.5; }
.wrap { max-width: 1040px; margin: 0 auto; padding: 32px 24px 64px; }
header { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
header .timestamp { color: var(--muted); font-size: 13px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 16px; }
.row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
@media (max-width: 720px) { .row { grid-template-columns: 1fr; } }
h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 14px; }
.score-wrap { display: flex; align-items: center; gap: 20px; }
.score-circle { width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(${verdictColor} ${data.debtScore * 3.6}deg, var(--border) 0deg);
  flex-shrink: 0; }
.score-circle::after { content: ''; position: absolute; }
.score-inner { width: 96px; height: 96px; background: var(--surface); border-radius: 50%; display: grid; place-items: center; text-align: center; }
.score-value { font-size: 28px; font-weight: 700; color: ${verdictColor}; line-height: 1; }
.score-label { font-size: 11px; color: var(--muted); margin-top: 4px; }
.score-verdict { flex: 1; font-size: 14px; color: var(--muted); }
.score-verdict strong { display: block; font-size: 16px; color: var(--text); margin-bottom: 4px; }
.donut { width: 160px; height: 160px; }
.donut-num { font-size: 22px; font-weight: 700; fill: var(--text); }
.donut-label { font-size: 10px; fill: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
.legend { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 12px; font-size: 13px; }
.legend-item { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.legend-dot { width: 10px; height: 10px; border-radius: 2px; }
.dot-block { background: #dc2626; }
.dot-warn { background: #ca8a04; }
.dot-pass { background: #16a34a; }
.donut-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
@media (max-width: 560px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
.metric { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.metric-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.metric-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
.metric-block { color: var(--bad); }
.metric-warn { color: var(--warn); }
.metric-pass { color: var(--good); }
.bar-row { display: grid; grid-template-columns: minmax(120px, 1fr) 3fr auto; gap: 10px; align-items: center; padding: 6px 0; font-size: 13px; }
.bar-label { color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-track { display: flex; height: 18px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.bar-seg { height: 100%; }
.bar-block { background: #dc2626; }
.bar-warn { background: #ca8a04; }
.bar-pass { background: #16a34a; }
.bar-count { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
table.rule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rule-table th, .rule-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.rule-table th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.rule-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.rule-table code { background: var(--bg); padding: 2px 6px; border-radius: 3px; font-size: 12px; }
.cell-block { color: var(--bad); font-weight: 600; }
.cell-warn { color: var(--warn); }
.cell-pass { color: var(--muted); }
.cell-date { color: var(--muted); white-space: nowrap; }
.top-blocked { list-style: none; padding: 0; margin: 0; }
.top-blocked li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
.top-blocked li:last-child { border-bottom: none; }
.top-blocked code { font-size: 13px; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.pill-block { background: rgba(220,38,38,0.12); color: var(--bad); }
.muted { color: var(--muted); font-size: 13px; }
footer { text-align: center; color: var(--muted); font-size: 12px; margin-top: 32px; }
footer a { color: var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>VGuard Quality Report</h1>
    <div class="timestamp">Generated ${escapeHtml(generated)}</div>
  </header>

  <section class="card">
    <h2>Technical Debt Score</h2>
    <div class="score-wrap">
      <div class="score-circle">
        <div class="score-inner">
          <div>
            <div class="score-value">${data.debtScore}</div>
            <div class="score-label">of 100</div>
          </div>
        </div>
      </div>
      <div class="score-verdict">
        <strong>${escapeHtml(verdict.label.split(' — ')[0] ?? verdict.label)}</strong>
        ${escapeHtml(verdict.label.split(' — ').slice(1).join(' — '))}
      </div>
    </div>
  </section>

  <section class="row">
    <div class="card">
      <h2>Outcome Mix</h2>
      <div class="donut-wrap">
        <div class="donut">${donutSvg(blocks, warns, passes)}</div>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot dot-block"></span>${blocks} blocks</span>
          <span class="legend-item"><span class="legend-dot dot-warn"></span>${warns} warns</span>
          <span class="legend-item"><span class="legend-dot dot-pass"></span>${passes} passes</span>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>Overview</h2>
      <div class="metrics">
        <div class="metric"><div class="metric-label">Total hits</div><div class="metric-value">${data.totalHits}</div></div>
        <div class="metric"><div class="metric-label">Blocks</div><div class="metric-value metric-block">${blocks}</div></div>
        <div class="metric"><div class="metric-label">Warns</div><div class="metric-value metric-warn">${warns}</div></div>
        <div class="metric"><div class="metric-label">Passes</div><div class="metric-value metric-pass">${passes}</div></div>
      </div>
    </div>
  </section>

  ${
    data.ruleHits.length > 0
      ? `<section class="card">
    <h2>Top Rules by Activity</h2>
    ${barChart(data.ruleHits)}
  </section>

  <section class="card">
    <h2>Rule Hit Frequency</h2>
    ${ruleTable(data.ruleHits)}
  </section>

  <section class="card">
    <h2>Most Blocked Rules</h2>
    <p class="muted">These rules block the most operations — consider whether they are too strict.</p>
    ${topBlockedList(data.ruleHits)}
  </section>`
      : `<section class="card"><p class="muted">No rule hit data to display. Run VGuard hooks first to collect data.</p></section>`
  }

  <footer>
    Generated by <a href="https://vguard.dev">VGuard</a>
  </footer>
</div>
</body>
</html>
`;
}

export async function saveHtmlReport(html: string, projectRoot: string): Promise<string> {
  const outputPath = join(projectRoot, '.vguard', 'reports', 'quality-report.html');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, 'utf-8');
  return outputPath;
}
