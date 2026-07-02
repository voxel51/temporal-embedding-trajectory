import React, { useMemo } from "react";
import {
  Peak,
  sceneSolid,
  segmentsOf,
} from "../utils/analysis";
import { useT } from "./ui";

const W = 948;
const H = 396;
const PAD = 34;

type Props = {
  /** 2D UMAP points, parallel to frames. */
  points: Array<[number, number]>;
  frames: number[];
  /** Per-index scene id (from scene-shift boundaries). */
  sceneOf: number[];
  /** Scene boundary peaks (for the chips). */
  scenePeaks: Peak[];
  /** Jump peaks (red rings). */
  jumpPeaks: Peak[];
  /** Index of the current frame (cursor). */
  cursorIdx: number;
  /** Trail length in frames. */
  win: number;
  onSeek: (frameNumber: number) => void;
};

/**
 * Redesigned trajectory view: the full embedding cloud in grey, the last
 * `win` frames as a connected trail colored by scene, red rings on jump
 * frames, and the yellow current-frame dot. Scene chips below seek to
 * each segment.
 */
export default function TrajectoryChart({
  points,
  frames,
  sceneOf,
  scenePeaks,
  jumpPeaks,
  cursorIdx,
  win,
  onSeek,
}: Props) {
  const T = useT();
  const n = points.length;

  const { px, py } = useMemo(() => {
    let nx = Infinity,
      xx = -Infinity,
      ny = Infinity,
      xy = -Infinity;
    for (const p of points) {
      if (p[0] < nx) nx = p[0];
      if (p[0] > xx) xx = p[0];
      if (p[1] < ny) ny = p[1];
      if (p[1] > xy) xy = p[1];
    }
    const sx = xx - nx || 1;
    const sy = xy - ny || 1;
    return {
      px: (v: number) => PAD + ((v - nx) / sx) * (W - 2 * PAD),
      py: (v: number) => PAD + (1 - (v - ny) / sy) * (H - 2 * PAD),
    };
  }, [points]);

  const grey = useMemo(() => {
    const out: Array<{ key: number; cx: string; cy: string }> = [];
    const step = Math.max(1, Math.floor(n / 850));
    for (let i = 0; i < n; i += step) {
      out.push({ key: i, cx: px(points[i][0]).toFixed(1), cy: py(points[i][1]).toFixed(1) });
    }
    return out;
  }, [n, points, px, py]);

  const { trailPath, trail } = useMemo(() => {
    if (cursorIdx < 0) return { trailPath: "", trail: [] as Array<{ key: number; cx: string; cy: string; fill: string }> };
    const i0 = Math.max(0, cursorIdx - win);
    let d = "";
    const pts: Array<{ key: number; cx: string; cy: string; fill: string }> = [];
    for (let i = i0; i <= cursorIdx; i++) {
      const X = px(points[i][0]);
      const Y = py(points[i][1]);
      d += (i === i0 ? "M" : "L") + X.toFixed(1) + " " + Y.toFixed(1);
      if ((i - i0) % 2 === 0 || i === cursorIdx) {
        pts.push({
          key: i,
          cx: X.toFixed(1),
          cy: Y.toFixed(1),
          fill: `oklch(72% 0.13 ${[228, 42, 152, 296, 86, 200][sceneOf[i] % 6]})`,
        });
      }
    }
    return { trailPath: d, trail: pts };
  }, [cursorIdx, win, points, px, py, sceneOf]);

  const rings = useMemo(
    () =>
      jumpPeaks.map((p) => ({
        key: p.i,
        cx: px(points[p.i][0]).toFixed(1),
        cy: py(points[p.i][1]).toFixed(1),
      })),
    [jumpPeaks, points, px, py]
  );

  const chips = useMemo(() => {
    const segs = segmentsOf(scenePeaks, n);
    return segs.map((s, i) => ({
      key: i,
      label: `S${i + 1}`,
      range: `${frames[s.start]}–${frames[Math.max(s.start, s.end - 1)]}`,
      active: cursorIdx >= s.start && cursorIdx < s.end,
      seekTo: frames[Math.min(s.start + 3, n - 1)],
      color: sceneSolid(i),
    }));
  }, [scenePeaks, n, frames, cursorIdx]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={6} fill="none" stroke={T.gridSoft} />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke={T.grid} />
        <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke={T.grid} />
        {grey.map((p) => (
          <circle key={p.key} cx={p.cx} cy={p.cy} r={1.8} fill={T.greyPoint} />
        ))}
        <path d={trailPath} fill="none" stroke={T.trailLine} strokeWidth={1} opacity={0.28} />
        {trail.map((p) => (
          <circle key={p.key} cx={p.cx} cy={p.cy} r={2.6} fill={p.fill} />
        ))}
        {rings.map((p) => (
          <circle key={p.key} cx={p.cx} cy={p.cy} r={5.5} fill="none" stroke="#ff5c5c" strokeWidth={1.6} />
        ))}
        {cursorIdx >= 0 && (
          <circle
            cx={px(points[cursorIdx][0]).toFixed(1)}
            cy={py(points[cursorIdx][1]).toFixed(1)}
            r={5}
            fill={T.cursor}
            stroke={T.bg}
            strokeWidth={1.5}
          />
        )}
      </svg>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 0 4px" }}>
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => onSeek(c.seekTo)}
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              flex: "none",
              gap: 6,
              padding: "4px 9px",
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: c.active ? T.bgRaised : "transparent",
              color: T.textSoft,
              fontFamily: T.sans,
              fontSize: T.fsMd,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                display: "inline-block",
                background: c.color,
              }}
            />
            {c.label}
            <span style={{ fontFamily: T.mono, fontSize: T.fsXs, color: T.textDim, marginLeft: 5 }}>
              {c.range}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
