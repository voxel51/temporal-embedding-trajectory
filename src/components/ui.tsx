import React from "react";
import { getSampleSrc } from "@fiftyone/state";
import { HUES } from "../utils/analysis";

/** Design tokens from the Claude Design redesign (dark panel). */
export const T = {
  bg: "#16181b",
  bgSub: "#131518",
  bgInset: "#0f1113",
  bgRaised: "#1d2024",
  bgCard: "#1a1d21",
  border: "#23272c",
  borderHi: "#2a2e33",
  text: "#e6e8ea",
  textSoft: "#b9c2cb",
  textMuted: "#8b939c",
  textDim: "#5b636b",
  a: "#58a6ff",
  b: "#f0883e",
  cursor: "#f2c94c",
  accent: "#2f6feb",
  accentSoft: "#5a8dee",
  grid: "#1a1e22",
  gridSoft: "#1e2226",
  mono: "'JetBrains Mono','SF Mono',ui-monospace,Menlo,monospace",
  sans: "Palanquin,system-ui,-apple-system,sans-serif",
};

export const segBtn = (on: boolean): React.CSSProperties => ({
  cursor: "pointer",
  flex: "none",
  whiteSpace: "nowrap",
  padding: "5px 15px",
  borderRadius: 6,
  border: "none",
  fontFamily: T.sans,
  fontWeight: 600,
  fontSize: 12.5,
  letterSpacing: ".3px",
  background: on ? "#31363d" : "transparent",
  color: on ? "#f2f4f6" : T.textMuted,
  transition: "background .15s",
});

export const segWrap: React.CSSProperties = {
  display: "flex",
  gap: 2,
  background: T.bgInset,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 3,
};

export const selectStyle: React.CSSProperties = {
  background: T.bgRaised,
  color: T.text,
  border: `1px solid ${T.borderHi}`,
  borderRadius: 6,
  padding: "5px 8px",
  fontFamily: T.mono,
  fontSize: 11,
};

/**
 * Frame thumbnail: real media when available, otherwise the design's
 * hue-gradient placeholder (hue keyed to the frame's scene) so layout
 * stays stable while media loads.
 */
export function Thumb({
  frameId,
  media,
  sceneIdx,
  style,
}: {
  frameId?: string;
  media: Record<string, string>;
  sceneIdx: number;
  style?: React.CSSProperties;
}) {
  const filepath = frameId ? media[frameId] : undefined;
  // media map holds server filepaths — convert to an app media URL
  const url = filepath ? getSampleSrc(filepath) : undefined;
  const h = HUES[((sceneIdx % HUES.length) + HUES.length) % HUES.length];
  const base: React.CSSProperties = url
    ? {
        backgroundImage: `url("${url}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(135deg, oklch(48% 0.07 ${h}) 0%, oklch(30% 0.05 ${h + 20}) 100%)`,
      };
  return <span style={{ display: "block", ...base, ...style }} />;
}
