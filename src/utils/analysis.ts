/**
 * Signal analysis for the redesigned panel: peak detection over a metric
 * series, greedy A/B boundary matching, and scene assignment.
 *
 * All functions work in INDEX space (positions in the scene's parallel
 * arrays); callers map indices to frame numbers for display/seeking.
 */

export type Peak = { i: number; v: number };

export type Stats = { mean: number; sd: number };

/** Scene hue palette (oklch hue angles), cycled per segment. */
export const HUES = [228, 42, 152, 296, 86, 200];

export const COLOR_A = "#58a6ff";
export const COLOR_B = "#f0883e";
export const COLOR_CURSOR = "#f2c94c";

export function sceneFill(idx: number, alpha = 0.5): string {
  return `oklch(60% 0.085 ${HUES[idx % HUES.length]} / ${alpha})`;
}

export function sceneSolid(idx: number, l = 65, c = 0.11): string {
  return `oklch(${l}% ${c} ${HUES[idx % HUES.length]})`;
}

export function stats(sig: number[]): Stats {
  const n = sig.length;
  if (n === 0) return { mean: 0, sd: 0 };
  const mean = sig.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(
    sig.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n
  );
  return { mean, sd };
}

/**
 * Threshold-crossing local maxima: values above mean + sigma*sd that are
 * a local max within +/-2 samples; peaks closer than `mergeWin` samples
 * are merged keeping the larger.
 */
export function detectPeaks(
  sig: number[],
  st: Stats,
  sigma: number,
  mergeWin = 12
): Peak[] {
  const thr = st.mean + sigma * st.sd;
  if (!(st.sd > 0)) return [];
  const n = sig.length;
  const out: Peak[] = [];
  for (let i = 2; i < n - 2; i++) {
    const v = sig[i];
    if (
      v > thr &&
      v >= sig[i - 1] &&
      v > sig[i + 1] &&
      v >= sig[i - 2] &&
      v > sig[i + 2]
    ) {
      const last = out[out.length - 1];
      if (last && i - last.i < mergeWin) {
        if (v > last.v) out[out.length - 1] = { i, v };
      } else {
        out.push({ i, v });
      }
    }
  }
  return out;
}

export type MatchResult = {
  pairs: Array<{ a: Peak; b: Peak }>;
  onlyA: Peak[];
  onlyB: Peak[];
};

/**
 * Greedy nearest-neighbor matching of two peak lists within a frame
 * tolerance. `frameOfA`/`frameOfB` map indices to frame numbers so the
 * tolerance is expressed in frames even if arrays are sparse.
 */
export function matchPeaks(
  A: Peak[],
  B: Peak[],
  tolFrames: number,
  frameOfA: (i: number) => number,
  frameOfB: (i: number) => number
): MatchResult {
  const used = new Set<number>();
  const pairs: Array<{ a: Peak; b: Peak }> = [];
  for (const a of A) {
    let best = -1;
    let bestD = Infinity;
    const fa = frameOfA(a.i);
    B.forEach((b, bi) => {
      if (used.has(bi)) return;
      const d = Math.abs(frameOfB(b.i) - fa);
      if (d <= tolFrames && d < bestD) {
        bestD = d;
        best = bi;
      }
    });
    if (best >= 0) {
      used.add(best);
      pairs.push({ a, b: B[best] });
    }
  }
  return {
    pairs,
    onlyA: A.filter((a) => !pairs.some((p) => p.a === a)),
    onlyB: B.filter((_, bi) => !used.has(bi)),
  };
}

/** Segment [start, end) index ranges between boundary peaks. */
export function segmentsOf(
  peaks: Peak[],
  n: number
): Array<{ start: number; end: number }> {
  const edges = [0, ...peaks.map((p) => p.i), n];
  const out: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < edges.length - 1; i++) {
    if (edges[i + 1] > edges[i]) out.push({ start: edges[i], end: edges[i + 1] });
  }
  return out;
}

/** Per-index scene id from boundary peaks. */
export function sceneAssignment(peaks: Peak[], n: number): number[] {
  const out = new Array<number>(n);
  let s = 0;
  const cuts = peaks.map((p) => p.i);
  for (let i = 0; i < n; i++) {
    if (s < cuts.length && i >= cuts[s]) s++;
    out[i] = s;
  }
  return out;
}

export function fmt(v: number | undefined | null): string {
  return v == null ? "–" : v.toFixed(3);
}

/** ~`count` round-numbered axis ticks over [0, max]. */
export function niceTicks(max: number, count = 5): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

/** Nearest index into `frames` for a given frame number (assumes sorted). */
export function indexOfFrame(frames: number[], frameNumber: number): number {
  if (frames.length === 0) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid] < frameNumber) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1] - frameNumber) <= Math.abs(frames[lo] - frameNumber)) {
    return lo - 1;
  }
  return lo;
}
