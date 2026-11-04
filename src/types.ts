export type Mode = "ops" | "memory" | "complexity";

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p99: number;
}

export interface CandidateResult {
  opsPerSecond: number;
  latencyUs: LatencyPercentiles;
  samples: number[];
  totalMs: number;
  output: string;
}

export interface MemoryEstimate {
  aAllocatedBytes: number;
  bAllocatedBytes: number;
  aPressure: "Low" | "Moderate" | "High";
  bPressure: "Low" | "Moderate" | "High";
  retentionHint: boolean;
}

export interface ComplexityPoint {
  size: number;
  aUs: number;
  bUs: number;
}

export interface ComplexityFit {
  label: string;
  slope: number;
}

export interface ComplexityResult {
  points: ComplexityPoint[];
  a: ComplexityFit;
  b: ComplexityFit;
}

export interface BenchmarkReport {
  candidateA: CandidateResult;
  candidateB: CandidateResult;
  iterations: number;
  inputSize: number;
  outputsMatch: boolean;
  memory: MemoryEstimate;
  complexity?: ComplexityResult;
  completedAt: string;
  sample: boolean;
}

export interface BenchmarkPreset {
  id: string;
  name: string;
  aName: string;
  bName: string;
  codeA: string;
  codeB: string;
}

export interface RunMessage {
  type: "run";
  id: number;
  codeA: string;
  codeB: string;
  iterations: number;
  inputSize: number;
  includeComplexity: boolean;
}

export type WorkerMessage =
  | { type: "progress"; id: number; percent: number; phase: string }
  | { type: "result"; id: number; report: BenchmarkReport }
  | { type: "error"; id: number; message: string };