export function formatOps(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function compactOps(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return Math.round(value).toString();
}

export function formatUs(value: number) {
  if (value < 0.01) return value.toFixed(3);
  if (value < 10) return value.toFixed(2);
  return value.toFixed(1);
}

export function formatMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function formatRatio(value: number) {
  return value.toFixed(1);
}