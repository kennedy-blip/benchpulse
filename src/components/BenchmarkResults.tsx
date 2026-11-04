import { Activity, ArrowUpRight, Check, Clock3, Info, Trophy, Zap } from "lucide-react";
import type { BenchmarkReport, CandidateResult } from "../types";
import { compactOps, formatOps, formatRatio, formatUs } from "../utils/format";

interface ResultsProps {
  report: BenchmarkReport;
  running: boolean;
  progress: number;
  stale: boolean;
  aName: string;
  bName: string;
}

const MICROSECONDS = "\u00b5s";

function ThroughputRow({ label, description, result, max, winner }: {
  label: "A" | "B";
  description: string;
  result: CandidateResult;
  max: number;
  winner: boolean;
}) {
  return (
    <div className="throughput-row">
      <div className="throughput-meta">
        <div className="throughput-identity"><span className={`small-candidate small-candidate-${label.toLowerCase()}`}>{label}</span><span>Candidate {label}</span><span className="throughput-description">{description}</span></div>
        <div className="throughput-number"><strong>{formatOps(result.opsPerSecond)}</strong><span>ops/sec</span></div>
      </div>
      <div className="meter-track" role="meter" aria-label={`Candidate ${label} operations per second`} aria-valuenow={Math.round(result.opsPerSecond)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
        <span className={`meter-fill ${winner ? "meter-fill-winner" : "meter-fill-slower"}`} style={{ width: `${Math.max(4, (result.opsPerSecond / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function BenchmarkResults({ report, running, progress, stale, aName, bName }: ResultsProps) {
  const aWins = report.candidateA.opsPerSecond >= report.candidateB.opsPerSecond;
  const fastest = aWins ? report.candidateA : report.candidateB;
  const slowest = aWins ? report.candidateB : report.candidateA;
  const winnerLabel = aWins ? "A" : "B";
  const ratio = fastest.opsPerSecond / Math.max(slowest.opsPerSecond, 0.001);
  const close = ratio < 1.03;
  const gain = Math.round((ratio - 1) * 100);
  const status = running ? `MEASURING ${progress}%` : report.sample ? "EXAMPLE DATA" : stale ? "PREVIOUS RUN" : "LATEST RUN";

  return (
    <section className="surface results-panel" aria-labelledby="results-title">
      <div className="panel-heading results-heading">
        <div className="panel-heading-main">
          <span className="heading-icon heading-icon-cyan"><Activity size={18} strokeWidth={1.9} /></span>
          <div><h2 id="results-title">Performance results</h2><p>Operations per second</p></div>
        </div>
        <span className={`data-badge ${running ? "data-badge-running" : report.sample || stale ? "data-badge-sample" : ""}`}><span />{status}</span>
      </div>

      <div className="winner-area">
        <div className="winner-topline"><span className="winner-icon"><Trophy size={17} strokeWidth={1.9} /></span><span>{close ? "CLOSE COMPARISON" : "SPEED WINNER"}</span></div>
        <div className="winner-main"><strong>{close ? "Near tie" : `Candidate ${winnerLabel}`}</strong><span className="winner-ratio">{close ? "< 3% apart" : `${formatRatio(ratio)}x faster`}</span></div>
        <p>{close ? "Both approaches performed similarly in this sample." : `${aWins ? aName : bName} delivers ${gain.toLocaleString("en-US")}% more throughput.`}</p>
      </div>

      <div className="throughput-section">
        <div className="section-inline-heading"><h3>Throughput comparison</h3><span>HIGHER IS BETTER <ArrowUpRight size={12} /></span></div>
        <ThroughputRow label="A" description={aName} result={report.candidateA} max={fastest.opsPerSecond} winner={aWins} />
        <ThroughputRow label="B" description={bName} result={report.candidateB} max={fastest.opsPerSecond} winner={!aWins} />
      </div>

      <div className="latency-section">
        <div className="section-inline-heading"><h3>Latency percentiles</h3><span title="Calculated from per-operation averages of measured batches">BATCH-NORMALIZED / OP</span></div>
        <div className="latency-grid">
          {(["p50", "p90", "p99"] as const).map((key) => (
            <div className="latency-card" key={key}>
              <span className="latency-label"><Clock3 size={12} /> {key}</span>
              <strong>{formatUs(fastest.latencyUs[key])}<small>{MICROSECONDS}</small></strong>
              <span className="latency-other">vs {formatUs(slowest.latencyUs[key])} {MICROSECONDS}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`result-footer ${!report.outputsMatch ? "result-footer-warning" : ""}`}>
        {report.outputsMatch ? <Check size={14} /> : <Info size={14} />}
        <span>{report.outputsMatch ? "Outputs match" : "Outputs differ. Compare the work each snippet performs."}</span>
        {report.outputsMatch && <span className="footer-divider">/</span>}
        {report.outputsMatch && <span>lower latency is better</span>}
      </div>
    </section>
  );
}

function linePath(values: number[], max: number) {
  const left = 56;
  const width = 690;
  const top = 17;
  const height = 175;
  return values.map((value, index) => `${index === 0 ? "M" : "L"} ${left + (index / Math.max(values.length - 1, 1)) * width} ${top + height - (value / max) * height}`).join(" ");
}

export function ExecutionChart({ report, onMemoryClick }: { report: BenchmarkReport; onMemoryClick?: () => void }) {
  const a = report.candidateA.samples;
  const b = report.candidateB.samples;
  const max = Math.max(...a, ...b, 1) * 1.15;
  const aPath = linePath(a, max);
  const bPath = linePath(b, max);
  const points = b.map((value, index) => ({ x: 56 + (index / Math.max(b.length - 1, 1)) * 690, y: 192 - (value / max) * 175 }));
  const areaPath = `${bPath} L 746 192 L 56 192 Z`;

  return (
    <section className="surface chart-panel" aria-labelledby="trace-title">
      <div className="panel-heading chart-heading">
        <div className="panel-heading-main">
          <span className="heading-icon heading-icon-purple"><Zap size={18} strokeWidth={1.9} /></span>
          <div><h2 id="trace-title">Execution trace</h2><p>Throughput across 12 measured batches</p></div>
        </div>
        <div className="chart-legend"><span><i className="legend-line legend-a" /> Candidate A</span><span><i className="legend-line legend-b" /> Candidate B</span></div>
      </div>
      <div className="chart-canvas">
        <svg viewBox="0 0 770 228" preserveAspectRatio="none" role="img" aria-label="Line chart comparing operations per second across twelve benchmark batches">
          <defs>
            <linearGradient id="trace-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.19" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient>
          </defs>
          {[0, 0.33, 0.66, 1].map((fraction, index) => {
            const y = 192 - fraction * 175;
            return <g key={index}><line x1="56" y1={y} x2="746" y2={y} stroke="#24313f" strokeDasharray="3 5" /><text x="43" y={y + 4} textAnchor="end" className="chart-axis-text">{compactOps(max * fraction)}</text></g>;
          })}
          <path d={areaPath} fill="url(#trace-fill)" />
          <path d={aPath} fill="none" stroke="#f5a524" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="trace-path trace-path-a" />
          <path d={bPath} fill="none" stroke="#17c995" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="trace-path trace-path-b" />
          {points.filter((_, index) => index === 0 || index === points.length - 1).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill="#10b981" stroke="#101923" strokeWidth="2" />)}
          {[0, 3, 7, 11].map((index) => <text key={index} x={56 + (index / 11) * 690} y="218" textAnchor="middle" className="chart-axis-text">{String(index + 1).padStart(2, "0")}</text>)}
        </svg>
      </div>
      <div className="chart-bottom"><span><span className="chart-live-dot" /> {report.sample ? "Illustrative trace" : "Measured in your browser"}</span><button type="button" onClick={onMemoryClick}>Inspect memory <ArrowUpRight size={14} /></button></div>
    </section>
  );
}