import { Activity, ArrowUpRight, Database, Info, ScanSearch, ShieldAlert, ShieldCheck, TrendingDown } from "lucide-react";
import type { BenchmarkReport } from "../types";
import { formatMB } from "../utils/format";

interface MemoryProps {
  report: BenchmarkReport;
  pageHeapBytes: number | null;
  stale?: boolean;
}

function AllocationBar({ report }: { report: BenchmarkReport }) {
  const { aAllocatedBytes, bAllocatedBytes } = report.memory;
  const total = Math.max(aAllocatedBytes + bAllocatedBytes, 1);

  return (
    <div className="allocation-bar" role="img" aria-label={`Estimated allocation: Candidate A ${formatMB(aAllocatedBytes)} megabytes, Candidate B ${formatMB(bAllocatedBytes)} megabytes`}>
      <span className="allocation-a" style={{ width: `${(aAllocatedBytes / total) * 100}%` }} />
      <span className="allocation-b" style={{ width: `${(bAllocatedBytes / total) * 100}%` }} />
    </div>
  );
}

export function MemoryOverview({ report, onOpen }: { report: BenchmarkReport; onOpen: () => void }) {
  return (
    <section className="surface memory-overview" aria-labelledby="memory-overview-title">
      <div className="panel-heading compact-heading">
        <div className="panel-heading-main"><span className="heading-icon heading-icon-cyan"><Database size={18} strokeWidth={1.9} /></span><div><h2 id="memory-overview-title">Memory snapshot</h2><p>Projected allocation per run</p></div></div>
        <button type="button" className="icon-button open-memory" onClick={onOpen} aria-label="Open memory inspector"><ArrowUpRight size={17} /></button>
      </div>
      <div className="overview-values">
        <div><span><i className="memory-key memory-key-a" /> CANDIDATE A</span><strong>{formatMB(report.memory.aAllocatedBytes)}<small>MB</small></strong></div>
        <div><span><i className="memory-key memory-key-b" /> CANDIDATE B</span><strong>{formatMB(report.memory.bAllocatedBytes)}<small>MB</small></strong></div>
      </div>
      <AllocationBar report={report} />
      <p className="memory-disclaimer"><Info size={13} /> Estimated from code patterns, not measured heap.</p>
    </section>
  );
}

export default function MemoryProfiler({ report, pageHeapBytes, stale = false }: MemoryProps) {
  const { aAllocatedBytes, bAllocatedBytes } = report.memory;
  const higher = aAllocatedBytes >= bAllocatedBytes ? "A" : "B";
  const lower = higher === "A" ? "B" : "A";
  const ratio = Math.max(aAllocatedBytes, bAllocatedBytes) / Math.max(Math.min(aAllocatedBytes, bAllocatedBytes), 1);
  const reduction = Math.round((1 - 1 / ratio) * 100);

  return (
    <section className="surface profiler-panel" aria-labelledby="profiler-title">
      <div className="panel-heading results-heading">
        <div className="panel-heading-main"><span className="heading-icon heading-icon-cyan"><Database size={18} strokeWidth={1.9} /></span><div><h2 id="profiler-title">Memory profile</h2><p>Allocation and heap visibility</p></div></div>
        <span className="data-badge data-badge-sample"><span />{report.sample ? "EXAMPLE DATA" : stale ? "PREVIOUS RUN" : "MODEL ESTIMATE"}</span>
      </div>
      <div className="profiler-intro"><span>PROJECTED ALLOCATION CHURN</span><p>Estimated bytes created across the selected iterations.</p></div>
      <div className="profiler-values">
        <div><span><i className="memory-key memory-key-a" /> Candidate A</span><strong>{formatMB(aAllocatedBytes)}<small> MB</small></strong></div>
        <div><span><i className="memory-key memory-key-b" /> Candidate B</span><strong>{formatMB(bAllocatedBytes)}<small> MB</small></strong></div>
      </div>
      <AllocationBar report={report} />
      <div className="profiler-insight"><span><TrendingDown size={18} /></span><div><strong>Candidate {lower} creates {reduction}% less modeled churn</strong><p>Fewer temporary allocations may mean less pressure on the garbage collector.</p></div></div>
      <div className="profiler-stat-list">
        <div><span>Higher allocation</span><strong>Candidate {higher} <span className="stat-accent">{ratio.toFixed(1)}x</span></strong></div>
        <div><span>Used heap (page) <span className="info-tooltip" title="Page-wide browser heap telemetry. It does not isolate either worker snippet."><Info size={12} /></span></span><strong>{pageHeapBytes === null ? "Unavailable" : `${formatMB(pageHeapBytes)} MB`}</strong></div>
        <div><span>Peak projected churn</span><strong>{formatMB(Math.max(aAllocatedBytes, bAllocatedBytes))} MB</strong></div>
      </div>
      <p className="profiler-footnote"><Info size={14} /> Allocation figures are code-pattern estimates, not per-snippet heap measurements.</p>
    </section>
  );
}

export function GarbageCollectionInspector({ report, pageHeapBytes }: MemoryProps) {
  const pressureA = report.memory.aPressure;
  const pressureB = report.memory.bPressure;
  const retention = report.memory.retentionHint;

  return (
    <section className="surface inspector-panel" aria-labelledby="inspector-title">
      <div className="panel-heading inspector-heading">
        <div className="panel-heading-main"><span className="heading-icon heading-icon-purple"><ScanSearch size={18} strokeWidth={1.9} /></span><div><h2 id="inspector-title">GC &amp; retention inspector</h2><p>Signals worth checking before calling something a leak</p></div></div>
        <span className="inspector-context">BROWSER DIAGNOSTICS</span>
      </div>
      <div className="inspector-grid">
        <div className="inspector-item">
          <span className="inspector-item-icon inspector-item-icon-muted"><Activity size={18} /></span>
          <span className="inspector-eyebrow">GC FREQUENCY</span>
          <strong>Not observable</strong>
          <p>Browsers do not expose collection counts for individual snippets to normal pages.</p>
        </div>
        <div className="inspector-item">
          <span className="inspector-item-icon inspector-item-icon-amber"><Database size={18} /></span>
          <span className="inspector-eyebrow">ALLOCATION PRESSURE</span>
          <strong>{pressureA === pressureB ? pressureA : `${pressureA} / ${pressureB}`}</strong>
          <p>Modeled pressure: Candidate A is {pressureA.toLowerCase()}, Candidate B is {pressureB.toLowerCase()}.</p>
        </div>
        <div className="inspector-item">
          <span className={`inspector-item-icon ${retention ? "inspector-item-icon-amber" : "inspector-item-icon-green"}`}>{retention ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}</span>
          <span className="inspector-eyebrow">RETENTION SCAN</span>
          <strong>{retention ? "Review retained state" : "No obvious retention"}</strong>
          <p>{retention ? "A global or cache write appears in the snippets. Review it for growing references." : "No global retention pattern found. One run cannot rule out memory leaks."}</p>
        </div>
      </div>
      <div className="inspector-footer"><Info size={14} /> {pageHeapBytes === null ? "Page heap telemetry is unavailable in this browser. Use DevTools for measured heap and GC timelines." : "Page heap telemetry is browser-wide; use DevTools to attribute memory and GC to a specific snippet."}</div>
    </section>
  );
}