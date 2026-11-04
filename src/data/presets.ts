import type { BenchmarkPreset, BenchmarkReport } from "../types";

export const DEFAULT_INPUT_SIZE = 512;

export const PRESETS: BenchmarkPreset[] = [
  {
    id: "array-transform",
    name: "Array transformations",
    aName: "filter + map + reduce",
    bName: "single-pass for loop",
    codeA: `const result = data
  .filter((value) => value % 2 === 0)
  .map((value) => value * 2);

return result.reduce(
  (sum, value) => sum + value,
  0
);`,
    codeB: `let sum = 0;
for (let i = 0; i < data.length; i++) {
  const value = data[i];
  if (value % 2 === 0) {
    sum += value * 2;
  }
}
return sum;`,
  },
  {
    id: "find-match",
    name: "Find a match",
    aName: "filter matches",
    bName: "count in one pass",
    codeA: `const matches = data.filter(
  (value) => value === 217
);

return matches.length;`,
    codeB: `let count = 0;
for (let i = 0; i < data.length; i++) {
  if (data[i] === 217) {
    count++;
  }
}
return count;`,
  },
  {
    id: "sort-scan",
    name: "Sort vs. scan",
    aName: "sort a copy",
    bName: "min / max scan",
    codeA: `const sorted = data.slice().sort((a, b) => a - b);

return sorted[0] + sorted[sorted.length - 1];`,
    codeB: `let min = Infinity;
let max = -Infinity;
for (let i = 0; i < data.length; i++) {
  if (data[i] < min) min = data[i];
  if (data[i] > max) max = data[i];
}
return min + max;`,
  },
];

const MB = 1024 * 1024;

// The first paint is populated with an explicitly labeled example, not a measured run.
export const SAMPLE_REPORT: BenchmarkReport = {
  candidateA: {
    opsPerSecond: 418_000,
    latencyUs: { p50: 2.39, p90: 2.55, p99: 2.81 },
    samples: [398_000, 420_000, 407_000, 431_000, 415_000, 423_000, 409_000, 427_000, 419_000, 436_000, 412_000, 420_000],
    totalMs: 2.39,
    output: "255248",
  },
  candidateB: {
    opsPerSecond: 1_420_000,
    latencyUs: { p50: 0.70, p90: 0.76, p99: 0.83 },
    samples: [1_345_000, 1_386_000, 1_419_000, 1_405_000, 1_453_000, 1_438_000, 1_412_000, 1_465_000, 1_440_000, 1_428_000, 1_472_000, 1_450_000],
    totalMs: 0.70,
    output: "255248",
  },
  iterations: 1_000,
  inputSize: DEFAULT_INPUT_SIZE,
  outputsMatch: true,
  memory: {
    aAllocatedBytes: 12.4 * MB,
    bAllocatedBytes: 2.1 * MB,
    aPressure: "Moderate",
    bPressure: "Low",
    retentionHint: false,
  },
  complexity: {
    points: [
      { size: 128, aUs: 0.62, bUs: 0.18 },
      { size: 256, aUs: 1.2, bUs: 0.35 },
      { size: 512, aUs: 2.39, bUs: 0.7 },
      { size: 1024, aUs: 4.81, bUs: 1.42 },
    ],
    a: { label: "O(n)", slope: 0.99 },
    b: { label: "O(n)", slope: 1.00 },
  },
  completedAt: "",
  sample: true,
};