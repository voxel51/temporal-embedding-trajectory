import React, { useMemo } from "react";
import {
  MatchResult,
  Peak,
  sceneFill,
  segmentsOf,
} from "../utils/analysis";
import { useT } from "./ui";

const W = 948;
const PL = 48;
const PR = 936;

type Row = {
  frames: number[];
  peaks: Peak[];
};

type Props = {
  a: Row;
  b: Row | null;
  match: MatchResult | null;
  /** Grey segments (jump metric) instead of scene colors. */
  neutral: boolean;
  cursorFrame: number | null;
  fMin: number;
  fMax: number;
};

/**
 * The redesign's alignment band: one row of scene segments per model with
 * white notches at cuts; in compare mode, connectors join cuts matched
 * within tolerance and dashed stubs mark unmatched cuts.
 */
export default function AlignmentBand({
  a,
  b,
  match,
  neutral,
  cursorFrame,
  fMin,
  fMax,
}: Props) {
  const T = useT();
  const span = Math.max(1, fMax - fMin);
  const x = (frame: number) => PL + ((frame - fMin) / span) * (PR - PL);

  const bandH = b ? 58 : 26;

  const segsOf = (row: Row) => {
    const segs = segmentsOf(row.peaks, row.frames.length);
    return segs.map((s, i) => {
      const x0 = x(row.frames[s.start]) + (i ? 1 : 0);
      const x1 = x(row.frames[Math.max(s.start, s.end - 1)]);
      return {
        key: i,
        x: x0,
        w: Math.max(1, x1 - x0 - 1),
        fill: neutral ? "rgba(230,232,234,.07)" : sceneFill(i),
      };
    });
  };

  const segsA = useMemo(() => segsOf(a), [a, neutral, fMin, span]);
  const segsB = useMemo(() => (b ? segsOf(b) : []), [b, neutral, fMin, span]);

  return (
    <svg viewBox={`0 0 ${W} ${bandH}`} style={{ display: "block", width: "100%", height: "auto" }}>
      <text x={30} y={17} textAnchor="end" fill={T.a} style={{ font: `600 ${T.fsTick}px ${T.mono}` }}>
        A
      </text>
      {segsA.map((s) => (
        <rect key={s.key} x={s.x} y={6} width={s.w} height={13} rx={2} fill={s.fill} />
      ))}
      {a.peaks.map((p) => (
        <rect key={"ka" + p.i} x={x(a.frames[p.i])} y={4} width={1.6} height={17} fill={T.text} />
      ))}
      {cursorFrame != null && (
        <line
          x1={x(cursorFrame)}
          x2={x(cursorFrame)}
          y1={2}
          y2={b ? 56 : 23}
          stroke={T.cursor}
          strokeWidth={1}
          opacity={0.7}
        />
      )}
      {b && match && (
        <g>
          <text x={30} y={50} textAnchor="end" fill={T.b} style={{ font: `600 ${T.fsTick}px ${T.mono}` }}>
            B
          </text>
          {segsB.map((s) => (
            <rect key={s.key} x={s.x} y={39} width={s.w} height={13} rx={2} fill={s.fill} />
          ))}
          {b.peaks.map((p) => (
            <rect key={"kb" + p.i} x={x(b.frames[p.i])} y={37} width={1.6} height={17} fill={T.text} />
          ))}
          {match.pairs.map((p) => (
            <line
              key={"c" + p.a.i}
              x1={x(a.frames[p.a.i])}
              x2={x(b.frames[p.b.i])}
              y1={21}
              y2={37}
              stroke={T.textSoft}
              strokeWidth={1.2}
              opacity={0.75}
            />
          ))}
          {match.onlyA.map((p) => (
            <line
              key={"sa" + p.i}
              x1={x(a.frames[p.i])}
              x2={x(a.frames[p.i])}
              y1={21}
              y2={28}
              stroke={T.a}
              strokeWidth={1.4}
              strokeDasharray="2 2"
            />
          ))}
          {match.onlyB.map((p) => (
            <line
              key={"sb" + p.i}
              x1={x(b.frames[p.i])}
              x2={x(b.frames[p.i])}
              y1={30}
              y2={37}
              stroke={T.b}
              strokeWidth={1.4}
              strokeDasharray="2 2"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
