import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  COLOR_A,
  COLOR_B,
  Peak,
  Stats,
  fmt,
  indexOfFrame,
  niceTicks,
} from "../utils/analysis";
import { T } from "./ui";

// ViewBox geometry (the SVG scales responsively; all math is in these units).
const W = 948;
const H = 292;
const PL = 48;
const PR = 936;
const PT = 14;
const PB = 266;

export type TimelineSeries = {
  values: number[];
  frames: number[];
  stats: Stats;
  peaks: Peak[];
  /** Peak identity → matched with the other model (filled marker). */
  matched: Set<Peak>;
};

type Props = {
  a: TimelineSeries;
  b: TimelineSeries | null;
  sigma: number;
  /** Yellow playhead frame number (null → hidden). */
  cursorFrame: number | null;
  onSeek: (frameNumber: number) => void;
  onSigma: (sigma: number) => void;
};

/**
 * The redesign's dual-model metric chart: model A (blue) and optionally
 * model B (orange) over frame number, with a draggable σ threshold line,
 * hover crosshair + tooltip, click-to-seek, and peak markers (filled =
 * matched across models, hollow = unmatched).
 */
export default function TimelineChart({
  a,
  b,
  sigma,
  cursorFrame,
  onSeek,
  onSigma,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null); // index into a.frames

  const fMin = a.frames[0] ?? 0;
  const fMax = a.frames[a.frames.length - 1] ?? 1;
  const span = Math.max(1, fMax - fMin);

  const vMax = useMemo(() => {
    let m = 0;
    for (const v of a.values) if (v > m) m = v;
    if (b) for (const v of b.values) if (v > m) m = v;
    return m > 0 ? m * 1.08 : 1;
  }, [a.values, b]);

  const x = useCallback(
    (frame: number) => PL + ((frame - fMin) / span) * (PR - PL),
    [fMin, span]
  );
  const y = useCallback((v: number) => PT + (1 - v / vMax) * (PB - PT), [vMax]);

  const pathOf = useCallback(
    (s: TimelineSeries) => {
      const n = s.values.length;
      const step = Math.max(1, Math.floor(n / 900));
      let d = "";
      for (let i = 0; i < n; i += step) {
        d += (d ? "L" : "M") + x(s.frames[i]).toFixed(1) + " " + y(s.values[i]).toFixed(1);
      }
      return d;
    },
    [x, y]
  );
  const pathA = useMemo(() => pathOf(a), [a, pathOf]);
  const pathB = useMemo(() => (b ? pathOf(b) : ""), [b, pathOf]);

  const thrA = a.stats.mean + sigma * a.stats.sd;
  const thrB = b ? b.stats.mean + sigma * b.stats.sd : 0;

  const ticksX = useMemo(() => {
    const raw = niceTicks(span, 7);
    return raw
      .map((v) => Math.round(fMin + v))
      .filter((f) => f <= fMax)
      .map((f) => ({ f, px: x(f) }));
  }, [span, fMin, fMax, x]);
  const ticksY = useMemo(
    () => niceTicks(vMax, 4).map((v) => ({ v, py: y(v) })),
    [vMax, y]
  );

  // client coords → nearest sample index (accounts for responsive scaling)
  const idxAt = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || a.frames.length === 0) return null;
      const r = svg.getBoundingClientRect();
      const vx = ((clientX - r.left) / r.width) * W;
      const frac = Math.max(0, Math.min(1, (vx - PL) / (PR - PL)));
      const f = fMin + frac * span;
      // nearest index
      let best = 0;
      let bd = Infinity;
      // frames are sorted — binary search
      let lo = 0;
      let hi = a.frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (a.frames[mid] < f) lo = mid + 1;
        else hi = mid;
      }
      for (const c of [lo - 1, lo]) {
        if (c < 0 || c >= a.frames.length) continue;
        const d = Math.abs(a.frames[c] - f);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      return best;
    },
    [a.frames, fMin, span]
  );

  const onThrDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg || !(a.stats.sd > 0)) return;
      const scaleY = svg.getBoundingClientRect().height / H;
      const y0 = e.clientY;
      const s0 = sigma;
      const valPerUnit = vMax / (PB - PT);
      const move = (ev: MouseEvent) => {
        const dv = ((y0 - ev.clientY) / scaleY) * valPerUnit;
        let ns = s0 + dv / a.stats.sd;
        ns = Math.max(0.5, Math.min(4, Math.round(ns * 20) / 20));
        onSigma(ns);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [sigma, vMax, a.stats.sd, onSigma]
  );

  const markers = useMemo(() => {
    const out: Array<{
      key: string;
      cx: number;
      cy: number;
      r: number;
      fill: string;
      stroke: string;
    }> = [];
    for (const p of a.peaks) {
      const mm = a.matched.has(p);
      out.push({
        key: "a" + p.i,
        cx: x(a.frames[p.i]),
        cy: y(p.v),
        r: mm ? 4.5 : 4,
        fill: mm || !b ? COLOR_A : T.bg,
        stroke: mm ? T.text : COLOR_A,
      });
    }
    if (b) {
      for (const p of b.peaks) {
        const mm = b.matched.has(p);
        out.push({
          key: "b" + p.i,
          cx: x(b.frames[p.i]),
          cy: y(p.v),
          r: mm ? 4.5 : 4,
          fill: mm ? COLOR_B : T.bg,
          stroke: mm ? T.text : COLOR_B,
        });
      }
    }
    return out;
  }, [a, b, x, y]);

  const cursorX = cursorFrame != null ? x(cursorFrame) : null;
  const hoverI = hover;
  const thrAY = y(Math.min(thrA, vMax));

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {ticksX.map((t) => (
          <g key={"x" + t.f}>
            <line x1={t.px} x2={t.px} y1={PT} y2={PB} stroke={T.grid} strokeWidth={1} />
            <text x={t.px} y={283} textAnchor="middle" fill={T.textDim} style={{ font: `10px ${T.mono}` }}>
              {t.f}
            </text>
          </g>
        ))}
        {ticksY.map((t) => (
          <g key={"y" + t.v.toFixed(4)}>
            <line x1={PL} x2={PR} y1={t.py} y2={t.py} stroke={T.gridSoft} strokeWidth={1} />
            <text x={PL - 6} y={t.py} dy={3} textAnchor="end" fill={T.textDim} style={{ font: `10px ${T.mono}` }}>
              {t.v.toFixed(2)}
            </text>
          </g>
        ))}
        {b && (
          <g>
            <line
              x1={PL}
              x2={PR}
              y1={y(Math.min(thrB, vMax))}
              y2={y(Math.min(thrB, vMax))}
              stroke={COLOR_B}
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={0.35}
            />
            <path d={pathB} fill="none" stroke={COLOR_B} strokeWidth={1.6} opacity={0.9} />
          </g>
        )}
        <path d={pathA} fill="none" stroke={COLOR_A} strokeWidth={1.6} />
        <line x1={PL} x2={PR} y1={thrAY} y2={thrAY} stroke="#aab3bc" strokeWidth={1} strokeDasharray="5 4" opacity={0.75} />
        <text x={PR - 4} y={thrAY} dy={-5} textAnchor="end" fill="#aab3bc" style={{ font: `10px ${T.mono}` }}>
          {`σ ${sigma.toFixed(2)} · thr ${fmt(thrA)}`}
        </text>
        {hoverI != null && (
          <line x1={x(a.frames[hoverI])} x2={x(a.frames[hoverI])} y1={PT} y2={PB} stroke="#ffffff" strokeWidth={1} opacity={0.14} />
        )}
        {cursorX != null && (
          <g>
            <line x1={cursorX} x2={cursorX} y1={PT} y2={PB} stroke={T.cursor} strokeWidth={1.2} opacity={0.9} />
            <text x={cursorX} y={10} textAnchor="middle" fill={T.cursor} style={{ font: `10px ${T.mono}` }}>
              {cursorFrame}
            </text>
          </g>
        )}
        {markers.map((m) => (
          <circle key={m.key} cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} stroke={m.stroke} strokeWidth={1.5} />
        ))}
        <rect
          x={PL}
          y={PT}
          width={PR - PL}
          height={PB - PT}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseMove={(e) => setHover(idxAt(e.clientX))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const i = idxAt(e.clientX);
            if (i != null) onSeek(a.frames[i]);
          }}
        />
        <rect
          x={PL}
          width={PR - PL}
          height={14}
          y={thrAY - 7}
          fill="transparent"
          style={{ cursor: "ns-resize" }}
          onMouseDown={onThrDown}
        />
      </svg>
      {hoverI != null && (
        <div
          style={{
            position: "absolute",
            left: `${(x(a.frames[hoverI]) / W) * 100}%`,
            top: 20,
            transform: "translateX(-50%)",
            background: "#22262b",
            border: "1px solid #2e3338",
            borderRadius: 6,
            padding: "5px 9px",
            pointerEvents: "none",
            zIndex: 5,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 18px rgba(0,0,0,.4)",
          }}
        >
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.text }}>
            fr {a.frames[hoverI]}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: COLOR_A, marginLeft: 8 }}>
            {fmt(a.values[hoverI])}
          </span>
          {b && (
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: COLOR_B, marginLeft: 8 }}>
              {/* B may have different coverage — look up by frame, not index */}
              {fmt(b.values[indexOfFrame(b.frames, a.frames[hoverI])])}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
