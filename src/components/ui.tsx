import React, { createContext, useContext } from "react";
import { getSampleSrc } from "@fiftyone/state";
import { HUES } from "../utils/analysis";

/**
 * Theme tokens. Two palettes (dark = the Claude Design redesign, light =
 * derived) selected by the app's theme atom; all components read tokens
 * via useT() so the panel respects the App's light/dark setting.
 *
 * Font sizes were bumped ~2px from the original design for legibility.
 */
export type Tokens = {
  mode: "dark" | "light";
  bg: string;
  bgSub: string;
  bgInset: string;
  bgRaised: string;
  bgCard: string;
  border: string;
  borderHi: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textDim: string;
  a: string;
  b: string;
  cursor: string;
  accent: string;
  accentSoft: string;
  grid: string;
  gridSoft: string;
  thr: string;
  hoverBg: string;
  statusBg: string;
  segOn: string;
  segOnText: string;
  greyPoint: string;
  trailLine: string;
  mono: string;
  sans: string;
  /** type scale */
  fsXs: number; // hints, badges, status
  fsSm: number; // labels, mono values
  fsMd: number; // controls, chips
  fsLg: number; // section titles
  fsTick: number; // svg axis ticks
};

const FONTS = {
  mono: "'JetBrains Mono','SF Mono',ui-monospace,Menlo,monospace",
  sans: "Palanquin,system-ui,-apple-system,sans-serif",
};

const SCALE = { fsXs: 12, fsSm: 12.5, fsMd: 13.5, fsLg: 14.5, fsTick: 12 };

export const DARK: Tokens = {
  mode: "dark",
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
  textDim: "#737d87",
  a: "#58a6ff",
  b: "#f0883e",
  cursor: "#f2c94c",
  accent: "#2f6feb",
  accentSoft: "#5a8dee",
  grid: "#1a1e22",
  gridSoft: "#1e2226",
  thr: "#aab3bc",
  hoverBg: "#22262b",
  statusBg: "#121417",
  segOn: "#31363d",
  segOnText: "#f2f4f6",
  greyPoint: "#343a41",
  trailLine: "#cfd6dd",
  ...FONTS,
  ...SCALE,
};

export const LIGHT: Tokens = {
  mode: "light",
  bg: "#ffffff",
  bgSub: "#f6f7f9",
  bgInset: "#eef0f3",
  bgRaised: "#f2f4f6",
  bgCard: "#f7f8fa",
  border: "#dfe3e8",
  borderHi: "#cdd3da",
  text: "#1c2127",
  textSoft: "#39434d",
  textMuted: "#5b6570",
  textDim: "#79838d",
  a: "#1f6feb",
  b: "#d9670f",
  cursor: "#b8860b",
  accent: "#2f6feb",
  accentSoft: "#5a8dee",
  grid: "#eceef1",
  gridSoft: "#e4e7ea",
  thr: "#5b6570",
  hoverBg: "#ffffff",
  statusBg: "#f2f4f6",
  segOn: "#d9dee4",
  segOnText: "#1c2127",
  greyPoint: "#c3c9d0",
  trailLine: "#39434d",
  ...FONTS,
  ...SCALE,
};

const TokensContext = createContext<Tokens>(DARK);

export const TokensProvider = TokensContext.Provider;

export function useT(): Tokens {
  return useContext(TokensContext);
}

export const segBtn = (t: Tokens, on: boolean): React.CSSProperties => ({
  cursor: "pointer",
  flex: "none",
  whiteSpace: "nowrap",
  padding: "5px 15px",
  borderRadius: 6,
  border: "none",
  fontFamily: t.sans,
  fontWeight: 600,
  fontSize: t.fsMd,
  letterSpacing: ".3px",
  background: on ? t.segOn : "transparent",
  color: on ? t.segOnText : t.textMuted,
  transition: "background .15s",
});

export const segWrap = (t: Tokens): React.CSSProperties => ({
  display: "flex",
  gap: 2,
  background: t.bgInset,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  padding: 3,
});

export const selectStyle = (t: Tokens): React.CSSProperties => ({
  background: t.bgRaised,
  color: t.text,
  border: `1px solid ${t.borderHi}`,
  borderRadius: 6,
  padding: "5px 8px",
  fontFamily: t.mono,
  fontSize: t.fsSm,
});

/**
 * Frame thumbnail: real media when available, otherwise a hue-gradient
 * placeholder (hue keyed to the frame's scene) so layout stays stable
 * while media loads.
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
