import type {
  BenchmarkReport,
  CandidateResult,
  ComplexityFit,
  ComplexityPoint,
  MemoryEstimate,
  RunMessage,
  WorkerMessage,
} from "../types";

type Snippet = (data: number[], size: number) => unknown;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RunMessage>) => void) | null;
  postMessage: (message: WorkerMessage) => void;
};

function send(message: WorkerMessage) {
  scope.postMessage(message);
}

function createData(size: number) {
  return Array.from({ length: size }, (_, index) => ((index * 37 + 13) % 997));
}

function serialize(value: unknown) {
  try {
    const result = JSON.stringify(value);
    return result ?? String(value);
  } catch {
    return String(value);
  }
}

function preview(value: unknown) {
  return serialize(value).slice(0, 120);
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function measurePair(
  fnA: Snippet,
  fnB: Snippet,
  dataA: number[],
  dataB: number[],
  iterations: number,
  id: number,
  includeComplexity: boolean,
) {
  type Measurement = { samples: number[]; perCallUs: number[]; totalMs: number; output: unknown };
  const a: Measurement = { samples: [], perCallUs: [], totalMs: 0, output: undefined };
  const b: Measurement = { samples: [], perCallUs: [], totalMs: 0, output: undefined };
  const batches = 12;
  let completedSteps = 0;

  for (let i = 0; i < 80; i++) {
    a.output = fnA(dataA, dataA.length);
    b.output = fnB(dataB, dataB.length);
  }

  function runBatch(label: "A" | "B", fn: Snippet, data: number[], measurement: Measurement, count: number) {
    const start = performance.now();
    for (let i = 0; i < count; i++) measurement.output = fn(data, data.length);
    const elapsed = Math.max(performance.now() - start, 0.001);
    measurement.totalMs += elapsed;
    measurement.samples.push((count / elapsed) * 1000);
    measurement.perCallUs.push((elapsed / count) * 1000);
    completedSteps += 1;
    send({
      type: "progress",
      id,
      phase: `Measuring Candidate ${label}`,
      percent: Math.round(5 + (completedSteps / (batches * 2)) * (includeComplexity ? 79 : 93)),
    });
  }

  // Alternate execution order so one candidate does not always benefit from running second.
  for (let batch = 0; batch < batches; batch++) {
    const count = Math.floor(iterations / batches) + (batch < iterations % batches ? 1 : 0);
    if (batch % 2 === 0) {
      runBatch("A", fnA, dataA, a, count);
      runBatch("B", fnB, dataB, b, count);
    } else {
      runBatch("B", fnB, dataB, b, count);
      runBatch("A", fnA, dataA, a, count);
    }
  }

  function summarize(measurement: Measurement): CandidateResult {
    return {
      opsPerSecond: (iterations / measurement.totalMs) * 1000,
      latencyUs: {
        p50: percentile(measurement.perCallUs, 0.5),
        p90: percentile(measurement.perCallUs, 0.9),
        p99: percentile(measurement.perCallUs, 0.99),
      },
      samples: measurement.samples,
      totalMs: measurement.totalMs,
      output: preview(measurement.output),
    };
  }

  return { resultA: summarize(a), resultB: summarize(b) };
}

function allocationWeight(code: string) {
  let weight = 0.12;
  const patterns: Array<[RegExp, number]> = [
    [/\.filter\s*\(/g, 0.65],
    [/\.map\s*\(/g, 0.9],
    [/\.flatMap\s*\(/g, 1.3],
    [/\.(?:slice|concat)\s*\(/g, 0.9],
    [/\.sort\s*\(/g, 0.12],
    [/\bnew\s+(?:Set|Map)\s*\(/g, 1.4],
    [/\bnew\s+(?:Array|Uint\d+Array|Float\d+Array)\s*\(/g, 1.0],
    [/\bArray\.from\s*\(/g, 1.0],
    [/\.push\s*\(/g, 0.55],
    [/=\s*\[\s*\]/g, 0.08],
  ];

  for (const [pattern, amount] of patterns) {
    weight += [...code.matchAll(pattern)].length * amount;
  }
  return weight;
}

function estimateMemory(codeA: string, codeB: string, size: number, iterations: number): MemoryEstimate {
  const estimate = (code: string) => Math.round((allocationWeight(code) * size * 8 + 128) * iterations);
  const aAllocatedBytes = estimate(codeA);
  const bAllocatedBytes = estimate(codeB);
  const pressure = (bytes: number): MemoryEstimate["aPressure"] => {
    if (bytes > 96 * 1024 * 1024) return "High";
    if (bytes > 8 * 1024 * 1024) return "Moderate";
    return "Low";
  };

  return {
    aAllocatedBytes,
    bAllocatedBytes,
    aPressure: pressure(aAllocatedBytes),
    bPressure: pressure(bAllocatedBytes),
    retentionHint: /\b(?:globalThis|self|window)\s*\.|\bcache\s*\.\s*push\s*\(/.test(`${codeA}\n${codeB}`),
  };
}

function measureInputSize(fn: Snippet, size: number) {
  const data = createData(size);
  let output: unknown;
  for (let i = 0; i < 30; i++) output = fn(data, size);

  let count = 32;
  let elapsed = 0;
  while (count <= 4096) {
    const start = performance.now();
    for (let i = 0; i < count; i++) output = fn(data, size);
    elapsed = performance.now() - start;
    if (elapsed >= 8 || count === 4096) break;
    count *= 2;
  }

  void output;
  return Math.max((elapsed / count) * 1000, 0.001);
}

function fitComplexity(points: ComplexityPoint[], candidate: "aUs" | "bUs"): ComplexityFit {
  const xs = points.map((point) => Math.log(point.size));
  const ys = points.map((point) => Math.log(point[candidate]));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index] - meanY), 0);
  const denominator = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const slope = denominator ? numerator / denominator : 0;

  let label = "O(1)";
  if (slope >= 0.35 && slope < 1.35) label = "O(n)";
  else if (slope >= 1.35 && slope < 1.8) label = "O(n log n)";
  else if (slope >= 1.8) label = "O(n^2+)";

  return { label, slope };
}

scope.onmessage = (event) => {
  const { id, codeA, codeB, iterations, inputSize, includeComplexity } = event.data;

  try {
    let candidateA: Snippet;
    let candidateB: Snippet;
    try {
      candidateA = new Function("data", "size", codeA) as Snippet;
    } catch (error) {
      throw new Error(`Candidate A syntax: ${error instanceof Error ? error.message : "invalid JavaScript"}`);
    }
    try {
      candidateB = new Function("data", "size", codeB) as Snippet;
    } catch (error) {
      throw new Error(`Candidate B syntax: ${error instanceof Error ? error.message : "invalid JavaScript"}`);
    }

    send({ type: "progress", id, phase: "Warming up the runtime", percent: 3 });
    const outputA = serialize(candidateA(createData(inputSize), inputSize));
    const outputB = serialize(candidateB(createData(inputSize), inputSize));
    const { resultA, resultB } = measurePair(candidateA, candidateB, createData(inputSize), createData(inputSize), iterations, id, includeComplexity);

    const report: BenchmarkReport = {
      candidateA: resultA,
      candidateB: resultB,
      iterations,
      inputSize,
      outputsMatch: outputA === outputB,
      memory: estimateMemory(codeA, codeB, inputSize, iterations),
      completedAt: new Date().toISOString(),
      sample: false,
    };

    if (includeComplexity) {
      const sizes = [128, 256, 512, 1024];
      const points = sizes.map((size, index) => {
        const point = {
          size,
          aUs: measureInputSize(candidateA, size),
          bUs: measureInputSize(candidateB, size),
        };
        send({
          type: "progress",
          id,
          phase: "Profiling input growth",
          percent: 85 + Math.round(((index + 1) / sizes.length) * 14),
        });
        return point;
      });
      report.complexity = {
        points,
        a: fitComplexity(points, "aUs"),
        b: fitComplexity(points, "bUs"),
      };
    }

    send({ type: "result", id, report });
  } catch (error) {
    send({
      type: "error",
      id,
      message: error instanceof Error ? error.message : "The snippet could not be executed.",
    });
  }
};