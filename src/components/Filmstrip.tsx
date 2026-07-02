import React from "react";
import { fmt } from "../utils/analysis";
import { Thumb, useT } from "./ui";

export type FilmFrame = {
  idx: number;
  frame: number;
  frameId?: string;
  value: number;
  /** 0..1 fraction of the metric max, for the signal bar. */
  frac: number;
  sceneIdx: number;
  isCurrent: boolean;
};

type Props = {
  frames: FilmFrame[];
  centerFrame: number;
  ctx: number;
  media: Record<string, string>;
  onSeek: (frameNumber: number) => void;
};

/** Context filmstrip around the current frame with a per-frame signal bar. */
export default function Filmstrip({ frames, centerFrame, ctx, media, onSeek }: Props) {
  const T = useT();
  return (
    <div style={{ padding: "11px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: T.fsLg, fontWeight: 600, color: T.text }}>Context</span>
        <span style={{ fontFamily: T.mono, fontSize: T.fsSm, color: T.textMuted, whiteSpace: "nowrap" }}>
          frame {centerFrame} ± {ctx}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: T.fsXs, color: T.textDim }}>bar = signal A at frame</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {frames.map((f) => (
          <button
            key={f.idx}
            onClick={() => onSeek(f.frame)}
            style={{
              cursor: "pointer",
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 5,
              padding: 6,
              borderRadius: 7,
              border: `1px solid ${f.isCurrent ? T.cursor + "88" : T.border}`,
              background: f.isCurrent ? T.bgRaised : "transparent",
            }}
          >
            <Thumb
              frameId={f.frameId}
              media={media}
              sceneIdx={f.sceneIdx}
              style={{ height: 58, borderRadius: 4 }}
            />
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: T.mono,
                fontSize: T.fsSm,
                color: T.textSoft,
              }}
            >
              <span>{f.frame}</span>
              <span style={{ color: T.textDim }}>{fmt(f.value)}</span>
            </span>
            <span style={{ display: "block", height: 3, background: T.border, borderRadius: 2 }}>
              <span
                style={{
                  display: "block",
                  height: 3,
                  width: `${Math.min(100, Math.round(f.frac * 100))}%`,
                  background: T.a,
                  borderRadius: 2,
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
