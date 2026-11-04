import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Cpu, Database, Download, FileJson, Gauge, Info, LoaderCircle, Network, Play, X } from "lucide-react";
import SnippetArena from "./components/SnippetArena";
import BenchmarkResults, { ExecutionChart } from "./components/BenchmarkResults";
import MemoryProfiler, { GarbageCollectionInspector, MemoryOverview } from "./components/MemoryProfiler";
import { ComplexityChart, ComplexitySummary } from "./components/ComplexityView";
import { DEFAULT_INPUT_SIZE, PRESETS, SAMPLE_REPORT } from "./data/presets";
import type { BenchmarkReport, Mode, RunMessage, WorkerMessage } from "./types";
import BenchmarkWorker from "./workers/benchmark.worker?worker&inline";

interface Notice {
  message: string;
  type: "success" | "error";
}

const TABS: { id: Mode; label: string; shortLabel: string; icon: typeof Gauge }[] = [
  { id: "ops", label: "Ops/Sec Benchmark", shortLabel: "Ops/Sec", icon: Gauge },
  { id: "memory", label: "Memory Allocation", shortLabel: "Memory", icon: Database },
  { id: "complexity", label: "Big-O Complexity", shortLabel: "Big-O", icon: Network },
];

function readPageHeap() {
  const browserPerformance = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  return typeof browserPerformance.memory?.usedJSHeapSize === "number" ? browserPerformance.memory.usedJSHeapSize : null;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("ops");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [codeA, setCodeA] = useState(PRESETS[0].codeA);
  const [codeB, setCodeB] = useState(PRESETS[0].codeB);
  const [iterations, setIterations] = useState(1_000);
  const [report, setReport] = useState<BenchmarkReport>(SAMPLE_REPORT);
  const [reportedSnippets, setReportedSnippets] = useState({ candidateA: PRESETS[0].codeA, candidateB: PRESETS[0].codeB });
  const [stale, setStale] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Preparing benchmark");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pageHeapBytes, setPageHeapBytes] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  const preset = PRESETS.find((item) => item.id === presetId);
  const aName = preset?.aName ?? "custom snippet";
  const bName = preset?.bName ?? "custom snippet";
  const engine = /Chrome|Chromium|Edg\//.test(navigator.userAgent) ? "V8 JS Compiler" : "Browser JS Engine";

  useEffect(() => {
    setPageHeapBytes(readPageHeap());
    return () => {
      workerRef.current?.terminate();
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  function showNotice(message: string, type: Notice["type"] = "success") {
    if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
    setNotice({ message, type });
    noticeTimeoutRef.current = window.setTimeout(() => setNotice(null), 3600);
  }

  function cleanupWorker() {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  function cancelRun() {
    runIdRef.current += 1;
    cleanupWorker();
    setRunning(false);
    setProgress(0);
    setPhase("Preparing benchmark");
    showNotice("Benchmark stopped. Your code was not changed.");
  }

  function runBenchmark(includeComplexity = mode === "complexity") {
    if (running || workerRef.current) return;
    if (!codeA.trim() || !codeB.trim()) {
      setError("Both candidates need JavaScript code before you can run a benchmark.");
      return;
    }

    setError(null);
    setRunning(true);
    setProgress(2);
    setPhase("Preparing benchmark");
    const id = ++runIdRef.current;

    try {
      const worker = new BenchmarkWorker();
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.id !== runIdRef.current) return;

        if (message.type === "progress") {
          setProgress(message.percent);
          setPhase(message.phase);
        } else if (message.type === "result") {
          cleanupWorker();
          setReport(message.report);
          setReportedSnippets({ candidateA: codeA, candidateB: codeB });
          setPageHeapBytes(readPageHeap());
          setStale(false);
          setProgress(100);
          setRunning(false);
          showNotice(includeComplexity ? "Benchmark suite complete." : "Benchmark complete. Results are ready.");
        } else {
          cleanupWorker();
          setRunning(false);
          setError(`Benchmark error: ${message.message}`);
          showNotice("Benchmark could not complete.", "error");
        }
      };

      worker.onerror = () => {
        if (id !== runIdRef.current) return;
        cleanupWorker();
        setRunning(false);
        setError("The benchmark worker could not start. Try refreshing the page.");
        showNotice("Benchmark worker failed.", "error");
      };

      timeoutRef.current = window.setTimeout(() => {
        if (id !== runIdRef.current) return;
        cleanupWorker();
        setRunning(false);
        setError("This run exceeded the time limit. Check for long loops or try fewer iterations.");
        showNotice("Benchmark timed out.", "error");
      }, iterations === 100_000 ? 45_000 : 25_000);

      const message: RunMessage = { type: "run", id, codeA, codeB, iterations, inputSize: DEFAULT_INPUT_SIZE, includeComplexity };
      worker.postMessage(message);
    } catch {
      cleanupWorker();
      setRunning(false);
      setError("This browser could not create a benchmark worker.");
    }
  }

  function runSuite() {
    runBenchmark(true);
  }

  function changePreset(id: string) {
    setPresetId(id);
    const selected = PRESETS.find((item) => item.id === id);
    if (selected) {
      setCodeA(selected.codeA);
      setCodeB(selected.codeB);
    }
    setStale(true);
    setError(null);
  }

  function resetCode() {
    const selected = preset ?? PRESETS[0];
    setPresetId(selected.id);
    setCodeA(selected.codeA);
    setCodeB(selected.codeB);
    setStale(true);
    setError(null);
    showNotice("Example snippets restored.");
  }

  function changeCode(candidate: "A" | "B", code: string) {
    if (candidate === "A") setCodeA(code);
    else setCodeB(code);
    setPresetId("custom");
    setStale(true);
    setError(null);
  }

  async function copyCode(code: string, label: string) {
    try {
      await navigator.clipboard.writeText(code);
      showNotice(`${label} code copied to clipboard.`);
    } catch {
      showNotice("Clipboard access is unavailable in this browser.", "error");
    }
  }

  function exportJSON() {
    const payload = {
      application: "BenchPulse",
      exportedAt: new Date().toISOString(),
      resultType: report.sample ? "illustrative-example" : stale ? "previous-run" : "measured-run",
      engine,
      currentSettings: { iterations, inputSize: DEFAULT_INPUT_SIZE, preset: presetId },
      currentSnippets: { candidateA: codeA, candidateB: codeB },
      reportedSnippets,
      report,
      pageHeapBytes,
      notes: "Allocation estimates are model-based. Page heap, if available, is not isolated per snippet. Empirical complexity is not a proof.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `benchpulse-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice(report.sample ? "Example report exported as JSON." : "Benchmark report exported as JSON.");
  }

  const lastRun = stale ? "Settings changed, rerun to update" : report.sample ? "Illustrative example loaded" : `Last run ${new Date(report.completedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="app-shell min-h-screen">
      <header className="site-header">
        <div className="shell header-inner flex items-center justify-between">
          <div className="brand-group">
            <div className="brand-mark"><Gauge size={25} strokeWidth={2.2} /></div>
            <div className="brand-wordmark"><span>Bench<span>Pulse</span></span><small>PERFORMANCE LAB</small></div>
            <span className="brand-divider" />
            <span className="engine-badge"><span className="engine-dot" /><span>Engine: <strong>{engine}</strong></span></span>
          </div>
          <div className="header-actions">
            <button type="button" className="header-export" onClick={exportJSON} title="Download the current report as JSON"><Download size={16} strokeWidth={2} /><span>Export Benchmark JSON</span></button>
            <button type="button" className="header-run" onClick={() => { setMode("ops"); runSuite(); }} disabled={running}><span className="header-run-icon">{running ? <LoaderCircle size={15} className="spin-icon" /> : <Play size={15} fill="currentColor" />}</span><span>{running ? "Running suite..." : "Run Benchmark Suite"}</span></button>
          </div>
        </div>
      </header>

      <nav className="mode-nav" aria-label="Execution modes">
        <div className="shell mode-nav-inner flex justify-between">
          <div className="mode-tabs" role="tablist" aria-label="Benchmark views">
            {TABS.map(({ id, label, shortLabel, icon: Icon }) => <button key={id} type="button" role="tab" aria-label={label} aria-selected={mode === id} className={`mode-tab ${mode === id ? "mode-tab-active" : ""}`} onClick={() => setMode(id)}><Icon size={17} strokeWidth={1.9} /><span className="tab-full">{label}</span><span className="tab-short">{shortLabel}</span></button>)}
          </div>
          <span className="nav-local"><span /> LOCAL WORKSPACE <span className="nav-local-slash">/</span> JS RUNTIME</span>
        </div>
      </nav>

      <main className="shell page-main">
        <div className="page-intro flex justify-between">
          <div>
            <div className="page-kicker"><span className="kicker-line" /> DEVELOPER WORKSPACE <span className="kicker-slash">/</span> BENCHMARK 01</div>
            <h1>Find the faster path<span>.</span></h1>
            <p>Compare real JavaScript, inspect the cost, and ship with confidence.</p>
          </div>
          <div className="intro-status"><span className="intro-status-dot" /><span>{lastRun}</span><span className="intro-status-separator" /><Cpu size={15} /><span>On-device execution</span></div>
        </div>

        {error && <div className="error-banner" role="alert"><AlertTriangle size={18} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={17} /></button></div>}

        <div className="workspace-grid grid">
          <SnippetArena
            presets={PRESETS}
            presetId={presetId}
            aName={aName}
            bName={bName}
            codeA={codeA}
            codeB={codeB}
            iterations={iterations}
            inputSize={DEFAULT_INPUT_SIZE}
            running={running}
            progress={progress}
            phase={phase}
            onPresetChange={changePreset}
            onCodeAChange={(code) => changeCode("A", code)}
            onCodeBChange={(code) => changeCode("B", code)}
            onIterationsChange={(value) => { setIterations(value); setStale(true); }}
            onRun={() => runBenchmark()}
            onCancel={cancelRun}
            onReset={resetCode}
            onCopy={copyCode}
          />
          {mode === "ops" && <BenchmarkResults report={report} running={running} progress={progress} stale={stale} aName={aName} bName={bName} />}
          {mode === "memory" && <MemoryProfiler report={report} pageHeapBytes={pageHeapBytes} stale={stale} />}
          {mode === "complexity" && <ComplexitySummary report={report} stale={stale} onRunSuite={runSuite} />}
        </div>

        {mode === "ops" && <div className="lower-grid grid"><ExecutionChart report={report} onMemoryClick={() => setMode("memory")} /><MemoryOverview report={report} onOpen={() => setMode("memory")} /></div>}
        {mode === "memory" && <GarbageCollectionInspector report={report} pageHeapBytes={pageHeapBytes} />}
        {mode === "complexity" && <ComplexityChart report={report} onRunSuite={runSuite} />}

        <footer className="site-footer flex items-center justify-between"><span><Info size={14} /> Runs happen in your browser. Timings vary by device and runtime.</span><span><FileJson size={14} /> BENCHPULSE <span className="footer-slash">/</span> BUILD, MEASURE, IMPROVE</span></footer>
      </main>

      {notice && <div className={`toast toast-${notice.type}`} role="status">{notice.type === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}<span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  );
}
