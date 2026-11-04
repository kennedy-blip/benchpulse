import { ArrowUpRight, ChartNoAxesCombined, Info, Network, Play } from "lucide-react";
import type { BenchmarkReport, ComplexityPoint } from "../types";
import { formatUs } from "../utils/format";

const MICROSECONDS = "\u00b5s";

function miniPath(points: ComplexityPoint[], key: "aUs" | "bUs", max: number) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${7 + (index / Math.max(points.length - 1, 1)) * 386} ${99 - (point[key] / max) * 82}`).join(" ");
}

export function ComplexitySummary({ report, stale, onRunSuite }: { report: BenchmarkReport; stale: boolean; onRunSuite: () => void }) {
  const result = report.complexity;

  return (
    <section className="surface complexity-summary" aria-labelledby="complexity-title">
      <div className="panel-heading results-heading">
        <div className="panel-heading-main"><span className="heading-icon heading-icon-cyan"><Network size={18} strokeWidth={1.9} /></span><div><h2 id="complexity-title">Complexity analysis</h2><p>How runtime scales with input</p></div></div>
        <span className="data-badge data-badge-sample"><span />{report.sample ? "EXAMPLE FIT" : stale ? "PREVIOUS RUN" : "EMPIRICAL FIT"}</span>
      </div>
      {!result ? (
        <div className="complexity-empty"><span className="empty-graph"><ChartNoAxesCombined size={30} /></span><h3>No scaling data yet</h3><p>Run the full benchmark suite to time both snippets at four input sizes.</p><button type="button" className="secondary-button" onClick={onRunSuite}><Play size={14} fill="currentColor" /> Run benchmark suite</button></div>
      ) : (
        <>
          <div className="complexity-topline">OBSERVED GROWTH RATE <span>128 TO 1,024 ITEMS</span></div>
          <div className="complexity-fits">
            <div><span><i className="memory-key memory-key-a" /> Candidate A</span><strong>{result.a.label}</strong><small>fitted slope {result.a.slope.toFixed(2)}</small></div>
            <div><span><i className="memory-key memory-key-b" /> Candidate B</span><strong>{result.b.label}</strong><small>fitted slope {result.b.slope.toFixed(2)}</small></div>
          </div>
          <div className="complexity-mini">
            <div className="complexity-mini-heading"><span>RUNTIME GROWTH</span><span>TIME / INPUT</span></div>
            <svg viewBox="0 0 400 110" preserveAspectRatio="none" role="img" aria-label="Mini chart comparing candidate runtime growth">
              {(() => {
                const max = Math.max(...result.points.flatMap((point) => [point.aUs, point.bUs]), 0.01) * 1.18;
                return <>
                  {[30, 65, 99].map((y) => <line key={y} x1="7" x2="393" y1={y} y2={y} stroke="#263746" strokeDasharray="3 5" />)}
                  <path d={miniPath(result.points, "aUs", max)} fill="none" stroke="#f5a524" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <path d={miniPath(result.points, "bUs", max)} fill="none" stroke="#17c995" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </>;
              })()}
            </svg>
            <div className="complexity-mini-axis"><span>128 items</span><span>1,024 items</span></div>
          </div>
          <div className="complexity-insight"><span className="insight-icon"><ArrowUpRight size={17} /></span><p>{Math.abs(result.a.slope - result.b.slope) < 0.25 ? "Both approaches grow at a similar rate. The speed difference is mostly a constant-factor improvement." : result.a.slope < result.b.slope ? "Candidate A grows more slowly as the input gets larger in this sample." : "Candidate B grows more slowly as the input gets larger in this sample."}</p></div>
          <p className="complexity-caveat"><Info size={14} /> An empirical fit is not a mathematical Big-O proof.</p>
        </>
      )}
    </section>
  );
}

function pathFor(points: ComplexityPoint[], key: "aUs" | "bUs", max: number) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${72 + (index / Math.max(points.length - 1, 1)) * 670} ${195 - (point[key] / max) * 165}`).join(" ");
}

export function ComplexityChart({ report, onRunSuite }: { report: BenchmarkReport; onRunSuite: () => void }) {
  const points = report.complexity?.points;

  return (
    <section className="surface scaling-panel" aria-labelledby="scaling-title">
      <div className="panel-heading chart-heading">
        <div className="panel-heading-main"><span className="heading-icon heading-icon-purple"><ChartNoAxesCombined size={18} strokeWidth={1.9} /></span><div><h2 id="scaling-title">Input-size scaling</h2><p>Average execution time as the dataset grows</p></div></div>
        <div className="chart-legend"><span><i className="legend-line legend-a" /> Candidate A</span><span><i className="legend-line legend-b" /> Candidate B</span></div>
      </div>
      {!points ? (
        <div className="scaling-empty"><p>Run the suite to compare execution time across multiple input sizes.</p><button type="button" className="secondary-button" onClick={onRunSuite}>Run full suite <ArrowUpRight size={14} /></button></div>
      ) : (
        <>
          <div className="chart-canvas scaling-canvas">
            <svg viewBox="0 0 770 232" preserveAspectRatio="none" role="img" aria-label="Line chart of execution time for candidates A and B at four input sizes">
              {(() => {
                const max = Math.max(...points.flatMap((point) => [point.aUs, point.bUs]), 0.01) * 1.18;
                return <>
                  {[0, 0.33, 0.66, 1].map((fraction, index) => {
                    const y = 195 - fraction * 165;
                    return <g key={index}><line x1="72" y1={y} x2="742" y2={y} stroke="#24313f" strokeDasharray="3 5" /><text x="57" y={y + 4} textAnchor="end" className="chart-axis-text">{formatUs(max * fraction)}</text></g>;
                  })}
                  <path d={pathFor(points, "aUs", max)} fill="none" stroke="#f5a524" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="trace-path trace-path-a" />
                  <path d={pathFor(points, "bUs", max)} fill="none" stroke="#17c995" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="trace-path trace-path-b" />
                  {points.map((point, index) => <g key={point.size}>
                    <circle cx={72 + (index / 3) * 670} cy={195 - (point.aUs / max) * 165} r="4" fill="#f5a524" stroke="#101923" strokeWidth="2" />
                    <circle cx={72 + (index / 3) * 670} cy={195 - (point.bUs / max) * 165} r="4" fill="#17c995" stroke="#101923" strokeWidth="2" />
                    <text x={72 + (index / 3) * 670} y="224" textAnchor="middle" className="chart-axis-text">{point.size.toLocaleString("en-US")}</text>
                  </g>)}
                </>;
              })()}
            </svg>
          </div>
          <div className="scaling-table-wrap">
            <div className="scaling-table-heading"><span>INPUT SIZE</span><span>CANDIDATE A</span><span>CANDIDATE B</span></div>
            {points.map((point) => <div className="scaling-table-row" key={point.size}><span>{point.size.toLocaleString("en-US")} items</span><span>{formatUs(point.aUs)} {MICROSECONDS}</span><span>{formatUs(point.bUs)} {MICROSECONDS}</span></div>)}
          </div>
          <p className="scaling-footnote"><Info size={13} /> Timings are measured locally. Fit labels describe these samples only.</p>
        </>
      )}
    </section>
  );
}