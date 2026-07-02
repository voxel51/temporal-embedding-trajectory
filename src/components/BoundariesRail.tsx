import React from "react";
import { COLOR_A, COLOR_B, fmt } from "../utils/analysis";
import { T, Thumb } from "./ui";

export type BoundaryItem = {
  /** Index into the owning scene's arrays (model A's for A+B pairs). */
  idx: number;
  frame: number;
  kind: "A+B" | "A" | "B";
  value: number;
  /** frame_ids for before/after thumbs (±context). */
  beforeId?: string;
  afterId?: string;
  sceneIdx: number;
};

export type BoundaryFilter = "all" | "both" | "A" | "B";

type Props = {
  label: string;
  items: BoundaryItem[];
  filter: BoundaryFilter;
  selectedFrame: number | null;
  media: Record<string, string>;
  onSeek: (frameNumber: number) => void;
};

const badgeStyle = (kind: BoundaryItem["kind"]): React.CSSProperties => ({
  fontFamily: T.mono,
  fontSize: 9,
  fontWeight: 600,
  padding: "2px 6px",
  borderRadius: 4,
  letterSpacing: ".5px",
  background:
    kind === "A+B"
      ? "rgba(230,232,234,.12)"
      : kind === "A"
      ? "rgba(88,166,255,.15)"
      : "rgba(240,136,62,.15)",
  color: kind === "A+B" ? T.text : kind === "A" ? COLOR_A : COLOR_B,
});

const hit = (item: BoundaryItem, filter: BoundaryFilter) =>
  filter === "all" ||
  (filter === "both" && item.kind === "A+B") ||
  (filter === "A" && item.kind === "A") ||
  (filter === "B" && item.kind === "B");

/**
 * Evidence rail: one card per detected boundary/jump with before→after
 * thumbnails, frame number, peak value, and an A+B/A/B provenance badge.
 * The chip filter DIMS non-matching cards rather than hiding them.
 */
export default function BoundariesRail({
  label,
  items,
  filter,
  selectedFrame,
  media,
  onSeek,
}: Props) {
  return (
    <div style={{ padding: "11px 16px 9px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{label}</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted }}>{items.length}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: T.textDim }}>
          click a card to seek · thumbs = before → after cut
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: T.textDim, padding: "8px 0" }}>
          No events at this σ — drag the dashed threshold down.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {items.map((b) => (
            <button
              key={b.kind + b.frame}
              onClick={() => onSeek(b.frame)}
              style={{
                cursor: "pointer",
                flex: "none",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: 8,
                borderRadius: 8,
                background: T.bgCard,
                border: `1px solid ${selectedFrame === b.frame ? T.accentSoft : T.border}`,
                textAlign: "left",
                opacity: hit(b, filter) ? 1 : 0.3,
                transition: "opacity .15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Thumb
                  frameId={b.beforeId}
                  media={media}
                  sceneIdx={Math.max(0, b.sceneIdx - 1)}
                  style={{ width: 52, height: 34, borderRadius: 3, display: "inline-block" }}
                />
                <span style={{ color: T.textDim, fontSize: 11 }}>▸</span>
                <Thumb
                  frameId={b.afterId}
                  media={media}
                  sceneIdx={b.sceneIdx}
                  style={{ width: 52, height: 34, borderRadius: 3, display: "inline-block" }}
                />
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.text }}>
                  #{b.frame}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>
                  {fmt(b.value)}
                </span>
                <span style={{ flex: 1 }} />
                <span style={badgeStyle(b.kind)}>{b.kind}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
