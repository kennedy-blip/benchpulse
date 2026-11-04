import { useState, type KeyboardEvent } from "react";
import { ChevronDown, Code2, Copy, Play, RotateCcw, ShieldCheck, Square } from "lucide-react";
import type { BenchmarkPreset } from "../types";

interface SnippetArenaProps {
  presets: BenchmarkPreset[];
  presetId: string;
  aName: string;
  bName: string;
  codeA: string;
  codeB: string;
  iterations: number;
  inputSize: number;
  running: boolean;
  progress: number;
  phase: string;
  onPresetChange: (id: string) => void;
  onCodeAChange: (code: string) => void;
  onCodeBChange: (code: string) => void;
  onIterationsChange: (iterations: number) => void;
  onRun: () => void;
  onCancel: () => void;
  onReset: () => void;
  onCopy: (code: string, label: string) => void;
}

const TOKEN_REGEX = /(\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|return|for|if|else|new|while|break|continue)\b|\b(?:true|false|Infinity|undefined)\b|\b\d+(?:\.\d+)?\b|\b(?:data|size)\b|\.(?:filter|map|reduce|length|push|slice|sort|find|includes)\b)/g;

function highlightCode(code: string) {
  return code.split(TOKEN_REGEX).map((part, index) => {
    let kind = "";
    if (/^\/\//.test(part)) kind = "comment";
    else if (/^["']/.test(part)) kind = "string";
    else if (/^(const|let|var|return|for|if|else|new|while|break|continue)$/.test(part)) kind = "keyword";
    else if (/^(true|false|Infinity|undefined|\d)/.test(part)) kind = "literal";
    else if (/^\./.test(part)) kind = "method";
    else if (/^(data|size)$/.test(part)) kind = "variable";

    return kind ? <span className={`syntax-${kind}`} key={index}>{part}</span> : <span key={index}>{part}</span>;
  });
}

interface CodeEditorProps {
  label: "A" | "B";
  description: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onCopy: () => void;
}

function CodeEditor({ label, description, value, disabled, onChange, onCopy }: CodeEditorProps) {
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const lines = Math.max(10, value.split("\n").length);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const input = event.currentTarget;
    const { selectionStart, selectionEnd } = input;
    onChange(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`);
    requestAnimationFrame(() => {
      input.selectionStart = selectionStart + 2;
      input.selectionEnd = selectionStart + 2;
    });
  }

  return (
    <div className={`code-editor code-editor-${label.toLowerCase()}`}>
      <div className="editor-toolbar">
        <div className="editor-identity">
          <span className={`candidate-letter candidate-letter-${label.toLowerCase()}`}>{label}</span>
          <span className="editor-candidate">Candidate {label}</span>
          <span className="editor-description">{description}</span>
        </div>
        <button type="button" className="icon-button editor-copy" onClick={onCopy} aria-label={`Copy Candidate ${label} code`} title="Copy snippet">
          <Copy size={14} strokeWidth={1.9} />
        </button>
      </div>
      <div className="editor-content">
        <div className="editor-gutter" aria-hidden="true">
          <div style={{ transform: `translateY(-${scroll.top}px)` }}>
            {Array.from({ length: lines }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}
          </div>
        </div>
        <div className="editor-input-wrap">
          <pre className="editor-highlight" aria-hidden="true" style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}><code>{highlightCode(value)}{"\n"}</code></pre>
          <textarea
            className="editor-textarea"
            aria-label={`Candidate ${label} JavaScript code`}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={(event) => setScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
          />
        </div>
      </div>
      <div className="editor-footer"><span className={`editor-status-dot editor-status-${label.toLowerCase()}`} />JavaScript<span className="editor-footer-separator">/</span> editable snippet</div>
    </div>
  );
}

export default function SnippetArena({
  presets,
  presetId,
  aName,
  bName,
  codeA,
  codeB,
  iterations,
  inputSize,
  running,
  progress,
  phase,
  onPresetChange,
  onCodeAChange,
  onCodeBChange,
  onIterationsChange,
  onRun,
  onCancel,
  onReset,
  onCopy,
}: SnippetArenaProps) {
  return (
    <section className="surface arena-panel" aria-labelledby="arena-title">
      <div className="panel-heading arena-heading">
        <div className="panel-heading-main">
          <span className="heading-icon heading-icon-cyan"><Code2 size={18} strokeWidth={1.9} /></span>
          <div>
            <h2 id="arena-title">Snippet arena</h2>
            <p>Same input. Two approaches. One clear answer.</p>
          </div>
        </div>
        <button type="button" className="text-action" onClick={onReset} disabled={running} title="Restore the selected example">
          <RotateCcw size={14} /> Reset code
        </button>
      </div>

      <div className="arena-workload">
        <div className="workload-select-group">
          <span className="field-label">WORKLOAD</span>
          <div className="select-shell workload-select-shell">
            <select value={presetId} onChange={(event) => onPresetChange(event.target.value)} disabled={running} aria-label="Choose benchmark workload">
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              <option value="custom">Custom snippets</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
        </div>
        <div className="workload-input"><span className="input-pulse" /> INPUT <strong>{inputSize.toLocaleString("en-US")}</strong> integers</div>
      </div>

      <div className="editors-grid">
        <CodeEditor label="A" description={aName} value={codeA} disabled={running} onChange={onCodeAChange} onCopy={() => onCopy(codeA, "Candidate A")} />
        <CodeEditor label="B" description={bName} value={codeB} disabled={running} onChange={onCodeBChange} onCopy={() => onCopy(codeB, "Candidate B")} />
      </div>

      <div className="arena-hint">Available input: <code>data</code> (number[]) and <code>size</code>. Return a comparable result from each snippet.</div>

      <div className="arena-controls">
        <div className="iteration-control">
          <label htmlFor="iteration-select" className="field-label">SAMPLE ITERATIONS</label>
          <div className="select-shell iteration-select-shell">
            <select id="iteration-select" value={iterations} onChange={(event) => onIterationsChange(Number(event.target.value))} disabled={running}>
              <option value={1000}>1,000 iterations</option>
              <option value={10000}>10,000 iterations</option>
              <option value={100000}>100,000 iterations</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
        </div>
        <span className="worker-note"><ShieldCheck size={15} /> Runs in a disposable Web Worker</span>
        <button type="button" className={`primary-button start-button ${running ? "button-cancel" : ""}`} onClick={running ? onCancel : onRun}>
          {running ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {running ? "Stop benchmark" : "Start benchmark"}
        </button>
      </div>

      {running && (
        <div className="run-progress" role="status" aria-live="polite">
          <div className="run-progress-label"><span><span className="running-indicator" />{phase}</span><strong>{progress}%</strong></div>
          <div className="run-progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
      )}
    </section>
  );
}