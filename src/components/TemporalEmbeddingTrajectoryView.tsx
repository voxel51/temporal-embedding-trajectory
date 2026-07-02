import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePanelContext, usePanelStatePartial } from "@fiftyone/spaces";

import { useTrajectoryData } from "../hooks/useTrajectoryData";
import { useFrameSync } from "../hooks/useFrameSync";
import { useCompareData } from "../hooks/useCompareData";
import { useFrameMedia } from "../hooks/useFrameMedia";
import {
  COLOR_A,
  COLOR_B,
  detectPeaks,
  indexOfFrame,
  matchPeaks,
  sceneAssignment,
  stats,
} from "../utils/analysis";
import type { MatchResult, Peak } from "../utils/analysis";
import TimelineChart, { TimelineSeries } from "./TimelineChart";
import TrajectoryChart from "./TrajectoryChart";
import AlignmentBand from "./AlignmentBand";
import BoundariesRail, { BoundaryFilter, BoundaryItem } from "./BoundariesRail";
import Filmstrip, { FilmFrame } from "./Filmstrip";
import { T, segBtn, segWrap, selectStyle } from "./ui";
import type { SceneTrajectory, TrajectoryViewProps } from "../types";

type ViewKind = "timeline" | "trajectory";
type MetricKind = "scene" | "jump";

const zerosLike = (s: SceneTrajectory) =>
  new Array(s.frame_numbers.length).fill(0);

function metricValues(s: SceneTrajectory, metric: MetricKind): number[] {
  if (metric === "jump") return s.jump_dists ?? zerosLike(s);
  const v = s.scene_shifts;
  return v && v.length === s.frame_numbers.length ? v : zerosLike(s);
}

function TemporalEmbeddingTrajectoryReady(props: TrajectoryViewProps) {
  // ── Panel state ────────────────────────────────────────────────────
  const [view, setView] = usePanelStatePartial<ViewKind>(
    "viewMode2",
    "timeline",
    true
  );
  const [metric, setMetric] = usePanelStatePartial<MetricKind>(
    "metric",
    "scene",
    true
  );
  const [compare, setCompare] = usePanelStatePartial<boolean>(
    "compareOn",
    false,
    true
  );
  const [brainA, setBrainA] = usePanelStatePartial<string | null>(
    "selectedBrainKey",
    null,
    true
  );
  const [brainB, setBrainB] = usePanelStatePartial<string | null>(
    "compareKeyB",
    null,
    true
  );
  const [sigma, setSigma] = usePanelStatePartial<number>("sceneSigma", 2, true);
  const [sigmaJ, setSigmaJ] = usePanelStatePartial<number>("jumpSigma", 2, true);
  const [tol, setTol] = usePanelStatePartial<number>("matchTolerance", 3, true);
  const [ctx, setCtx] = usePanelStatePartial<number>("contextHalf", 2, true);
  const [win, setWin] = usePanelStatePartial<number>(
    "trajectoryLength",
    120,
    true
  );
  const [selectedFrame, setSelectedFrame] = usePanelStatePartial<number | null>(
    "selectedFrame",
    null,
    true
  );
  const [filter, setFilter] = usePanelStatePartial<BoundaryFilter>(
    "boundaryFilter",
    "all",
    true
  );
  const [trajModel, setTrajModel] = usePanelStatePartial<"A" | "B">(
    "trajModel",
    "A",
    true
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Data ───────────────────────────────────────────────────────────
  const { brainKeys, scene, triggers, currentSampleId } = useTrajectoryData(
    props,
    [brainA, setBrainA]
  );
  const { currentFrame, seekFrame, isTimelineActive } = useFrameSync();

  // Seed B with a different key once available.
  useEffect(() => {
    if (!brainB && brainKeys.length > 1) {
      const candidate = brainKeys.find((bk) => bk.key !== brainA);
      if (candidate) setBrainB(candidate.key);
    }
  }, [brainKeys, brainA, brainB, setBrainB]);

  const compareKeys = useMemo(
    () =>
      [brainA, compare ? brainB : null].filter((k): k is string => !!k),
    [brainA, brainB, compare]
  );
  const { scenes: compareScenes } = useCompareData(
    props,
    currentSampleId,
    compareKeys
  );

  const sceneA: SceneTrajectory | null =
    (brainA ? compareScenes[brainA] : null) ?? scene ?? null;
  const sceneB: SceneTrajectory | null =
    compare && brainB && brainB !== brainA
      ? compareScenes[brainB] ?? null
      : null;

  // ── Analysis (active metric drives timeline/band/rail) ─────────────
  const jm = metric === "jump";
  const activeSigma = (jm ? sigmaJ : sigma) ?? 2;
  const setActiveSigma = jm ? setSigmaJ : setSigma;

  const valsA = useMemo(
    () => (sceneA ? metricValues(sceneA, metric ?? "scene") : []),
    [sceneA, metric]
  );
  const valsB = useMemo(
    () => (sceneB ? metricValues(sceneB, metric ?? "scene") : []),
    [sceneB, metric]
  );
  const statsA = useMemo(() => stats(valsA), [valsA]);
  const statsB = useMemo(() => stats(valsB), [valsB]);
  const peaksA = useMemo(
    () => (sceneA ? detectPeaks(valsA, statsA, activeSigma) : []),
    [sceneA, valsA, statsA, activeSigma]
  );
  const peaksB = useMemo(
    () => (sceneB ? detectPeaks(valsB, statsB, activeSigma) : []),
    [sceneB, valsB, statsB, activeSigma]
  );
  const match: MatchResult | null = useMemo(() => {
    if (!sceneA || !sceneB) return null;
    return matchPeaks(
      peaksA,
      peaksB,
      Math.max(0, tol ?? 3),
      (i) => sceneA.frame_numbers[i],
      (i) => sceneB.frame_numbers[i]
    );
  }, [sceneA, sceneB, peaksA, peaksB, tol]);

  const matchedA = useMemo(
    () => new Set<Peak>((match?.pairs ?? []).map((p) => p.a)),
    [match]
  );
  const matchedB = useMemo(
    () => new Set<Peak>((match?.pairs ?? []).map((p) => p.b)),
    [match]
  );

  // Scene assignment always comes from the SCENE metric of model A —
  // used for thumbnail hues and status ("scene X of Y").
  const scenePeaksA = useMemo(() => {
    if (!sceneA) return [] as Peak[];
    const v = metricValues(sceneA, "scene");
    return detectPeaks(v, stats(v), sigma ?? 2);
  }, [sceneA, sigma]);
  const sceneOfA = useMemo(
    () =>
      sceneA ? sceneAssignment(scenePeaksA, sceneA.frame_numbers.length) : [],
    [sceneA, scenePeaksA]
  );

  // ── Cursor / seeking ───────────────────────────────────────────────
  const nA = sceneA?.frame_numbers.length ?? 0;
  const activeFrame = useMemo(() => {
    if (currentFrame != null) return currentFrame;
    if (selectedFrame != null) return selectedFrame;
    return sceneA && nA > 0 ? sceneA.frame_numbers[nA - 1] : null;
  }, [currentFrame, selectedFrame, sceneA, nA]);
  const cursorIdxA = useMemo(
    () =>
      sceneA && activeFrame != null
        ? indexOfFrame(sceneA.frame_numbers, activeFrame)
        : -1,
    [sceneA, activeFrame]
  );

  const handleSeek = useCallback(
    (frameNumber: number) => {
      setSelectedFrame(frameNumber);
      seekFrame(frameNumber);
      if (sceneA && currentSampleId && currentSampleId !== sceneA.sample_id) {
        triggers.seekToFrame({
          sample_id: sceneA.sample_id,
          frame_number: frameNumber,
        });
      }
    },
    [seekFrame, setSelectedFrame, sceneA, currentSampleId, triggers]
  );

  // ←/→ step frames (⇧ = ×10), per the design.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!sceneA || cursorIdxA < 0) return;
      e.preventDefault();
      const st = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
      const ni = Math.max(0, Math.min(nA - 1, cursorIdxA + st));
      handleSeek(sceneA.frame_numbers[ni]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sceneA, cursorIdxA, nA, handleSeek]);

  // ── Boundaries list (rail + chips) ─────────────────────────────────
  const boundaries: BoundaryItem[] = useMemo(() => {
    if (!sceneA) return [];
    const thumbAt = (s: SceneTrajectory, i: number, d: number) =>
      s.frame_ids[Math.max(0, Math.min(s.frame_numbers.length - 1, i + d))];
    const mk = (
      s: SceneTrajectory,
      p: Peak,
      kind: BoundaryItem["kind"]
    ): BoundaryItem => ({
      idx: p.i,
      frame: s.frame_numbers[p.i],
      kind,
      value: p.v,
      beforeId: thumbAt(s, p.i, -4),
      afterId: thumbAt(s, p.i, +4),
      sceneIdx: sceneOfA[Math.min(p.i, Math.max(0, sceneOfA.length - 1))] ?? 0,
    });
    let items: BoundaryItem[];
    if (sceneB && match) {
      items = [
        ...match.pairs.map((p) => ({
          ...mk(sceneA, p.a, "A+B" as const),
          value: Math.max(p.a.v, p.b.v),
        })),
        ...match.onlyA.map((p) => mk(sceneA, p, "A")),
        ...match.onlyB.map((p) => mk(sceneB, p, "B")),
      ];
    } else {
      items = peaksA.map((p) => mk(sceneA, p, "A"));
    }
    return items.sort((x, y) => x.frame - y.frame);
  }, [sceneA, sceneB, match, peaksA, sceneOfA]);

  // ── Filmstrip ──────────────────────────────────────────────────────
  const vMaxA = useMemo(() => Math.max(1e-9, ...valsA), [valsA]);
  const film: FilmFrame[] = useMemo(() => {
    if (!sceneA || cursorIdxA < 0) return [];
    const half = Math.max(1, ctx ?? 2);
    const out: FilmFrame[] = [];
    for (let i = cursorIdxA - half; i <= cursorIdxA + half; i++) {
      const ci = Math.max(0, Math.min(nA - 1, i));
      out.push({
        idx: i,
        frame: sceneA.frame_numbers[ci],
        frameId: sceneA.frame_ids[ci],
        value: valsA[ci] ?? 0,
        frac: (valsA[ci] ?? 0) / vMaxA,
        sceneIdx: sceneOfA[ci] ?? 0,
        isCurrent: ci === cursorIdxA,
      });
    }
    return out;
  }, [sceneA, cursorIdxA, ctx, nA, valsA, vMaxA, sceneOfA]);

  // ── Frame media (thumbs for rail + filmstrip) ──────────────────────
  const mediaIds = useMemo(() => {
    const ids: string[] = [];
    for (const b of boundaries) {
      if (b.beforeId) ids.push(b.beforeId);
      if (b.afterId) ids.push(b.afterId);
    }
    for (const f of film) if (f.frameId) ids.push(f.frameId);
    return ids;
  }, [boundaries, film]);
  const { media } = useFrameMedia(props, mediaIds);

  // ── Trajectory view derived state ──────────────────────────────────
  const trajScene = trajModel === "B" && sceneB ? sceneB : sceneA;
  const trajSceneKey = trajModel === "B" && sceneB ? brainB : brainA;
  const trajDerived = useMemo(() => {
    if (!trajScene) return null;
    const sv = metricValues(trajScene, "scene");
    const jv = metricValues(trajScene, "jump");
    const sPeaks = detectPeaks(sv, stats(sv), sigma ?? 2);
    const jPeaks = detectPeaks(jv, stats(jv), sigmaJ ?? 2);
    return {
      scenePeaks: sPeaks,
      jumpPeaks: jPeaks,
      sceneOf: sceneAssignment(sPeaks, trajScene.frame_numbers.length),
      cursorIdx:
        activeFrame != null
          ? indexOfFrame(trajScene.frame_numbers, activeFrame)
          : -1,
    };
  }, [trajScene, sigma, sigmaJ, activeFrame]);

  // ── Timeline series ────────────────────────────────────────────────
  const seriesA: TimelineSeries | null = sceneA
    ? {
        values: valsA,
        frames: sceneA.frame_numbers,
        stats: statsA,
        peaks: peaksA,
        matched: matchedA,
      }
    : null;
  const seriesB: TimelineSeries | null = sceneB
    ? {
        values: valsB,
        frames: sceneB.frame_numbers,
        stats: statsB,
        peaks: peaksB,
        matched: matchedB,
      }
    : null;

  const noBrainKeys = brainKeys.length === 0;
  const sceneShiftMissing = !jm && sceneA != null && !valsA.some((v) => v > 0);

  const handleCompute = useCallback(() => {
    triggers.computeTrajectory({});
  }, [triggers]);

  const fMin = sceneA?.frame_numbers[0] ?? 0;
  const fMax = sceneA?.frame_numbers[Math.max(0, nA - 1)] ?? 1;

  // ── Grid surface (no sample open) ──────────────────────────────────
  if (!currentSampleId) {
    return (
      <div style={styles.root}>
        <div style={styles.cta}>
          <p style={{ fontSize: 14, color: "rgba(220,220,230,.9)", margin: 0 }}>
            {noBrainKeys
              ? "Pick a model and click Compute to embed your video frames."
              : "Open a video sample in the modal to view its trajectory."}
          </p>
          <p
            style={{
              color: T.textDim,
              fontSize: 11,
              maxWidth: 360,
              margin: 0,
            }}
          >
            Once the compute run finishes, open a video sample and add the
            Temporal Embedding Trajectory panel in the modal to explore the
            results.
          </p>
          <button style={styles.compute} onClick={handleCompute}>
            Compute
          </button>
        </div>
      </div>
    );
  }

  const chipStyle = (on: boolean): React.CSSProperties => ({
    cursor: "pointer",
    flex: "none",
    whiteSpace: "nowrap",
    padding: "4px 11px",
    borderRadius: 20,
    border: `1px solid ${on ? T.accentSoft : T.borderHi}`,
    background: on ? "rgba(90,141,238,.14)" : "transparent",
    color: on ? "#cfe0ff" : T.textMuted,
    fontFamily: T.sans,
    fontSize: 11.5,
    fontWeight: 600,
  });

  const cutsLabel = jm ? "jumps" : "scene cuts";
  const statusL = sceneA
    ? `${nA} frames · ${cutsLabel} — A ${peaksA.length}` +
      (sceneB && match
        ? ` · B ${peaksB.length} · matched ${match.pairs.length}`
        : "")
    : "no scene loaded";
  const nScenes = scenePeaksA.length + 1;
  const statusR =
    activeFrame != null && cursorIdxA >= 0
      ? `frame ${activeFrame} · scene ${(sceneOfA[cursorIdxA] ?? 0) + 1} of ${nScenes}`
      : isTimelineActive
      ? "waiting for timeline"
      : "timeline inactive — open a video modal";

  return (
    <div style={styles.root}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        <div style={segWrap}>
          <button
            style={segBtn(view === "timeline")}
            onClick={() => setView("timeline")}
          >
            Timeline
          </button>
          <button
            style={segBtn(view === "trajectory")}
            onClick={() => setView("trajectory")}
          >
            Trajectory
          </button>
        </div>
        <div style={styles.modelPick}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: COLOR_A,
            }}
          />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>
            A
          </span>
          <select
            style={selectStyle}
            value={brainA ?? ""}
            onChange={(e) => setBrainA(e.target.value || null)}
            disabled={noBrainKeys}
          >
            {noBrainKeys ? (
              <option value="">(none — compute first)</option>
            ) : (
              brainKeys.map((bk) => (
                <option key={bk.key} value={bk.key}>
                  {bk.key}
                </option>
              ))
            )}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>Compare</span>
          <button
            onClick={() => {
              setCompare(!compare);
              setFilter("all");
              setTrajModel("A");
            }}
            style={{
              cursor: "pointer",
              width: 34,
              height: 19,
              borderRadius: 10,
              border: `1px solid ${T.borderHi}`,
              background: compare ? T.accentSoft : T.border,
              position: "relative",
              padding: 0,
              transition: "background .15s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: compare ? 16 : 2,
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "#f2f4f6",
                transition: "left .15s",
              }}
            />
          </button>
        </div>
        {compare && (
          <div style={styles.modelPick}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: COLOR_B,
              }}
            />
            <span
              style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}
            >
              B
            </span>
            <select
              style={selectStyle}
              value={brainB ?? ""}
              onChange={(e) => setBrainB(e.target.value || null)}
              disabled={noBrainKeys}
            >
              <option value="">—</option>
              {brainKeys.map((bk) => (
                <option key={bk.key} value={bk.key}>
                  {bk.key}
                </option>
              ))}
            </select>
          </div>
        )}
        <span style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            style={{
              cursor: "pointer",
              width: 30,
              height: 30,
              borderRadius: 7,
              border: `1px solid ${settingsOpen ? T.accentSoft : T.borderHi}`,
              background: settingsOpen ? T.bgRaised : "transparent",
              color: T.textSoft,
              fontSize: 14,
            }}
            title="Detection & display settings"
          >
            ⚙
          </button>
          {settingsOpen && (
            <div style={styles.settings}>
              <Slider
                label="Scene σ"
                value={sigma ?? 2}
                min={0.5}
                max={4}
                step={0.05}
                onChange={setSigma}
              />
              <Slider
                label="Jump σ"
                value={sigmaJ ?? 2}
                min={0.5}
                max={4}
                step={0.05}
                onChange={setSigmaJ}
              />
              <Slider
                label="Match tolerance"
                value={tol ?? 3}
                min={0}
                max={8}
                step={1}
                onChange={setTol}
                fmt={(v) => `±${v} fr`}
              />
              <Slider
                label="Context"
                value={ctx ?? 2}
                min={1}
                max={8}
                step={1}
                onChange={setCtx}
                fmt={(v) => `±${v} fr`}
              />
              <div>
                <Slider
                  label="Trail length"
                  value={win ?? 120}
                  min={10}
                  max={400}
                  step={10}
                  onChange={setWin}
                  fmt={(v) => `${v} fr`}
                />
                <div
                  style={{
                    fontSize: 10,
                    color: T.textDim,
                    lineHeight: 1.4,
                    marginTop: 4,
                  }}
                >
                  Trajectory view only: how many recent frames are drawn
                  colored + connected; older frames stay grey.
                </div>
              </div>
            </div>
          )}
        </div>
        <button style={styles.compute} onClick={handleCompute}>
          Compute
        </button>
      </div>

      {/* ── Agreement strip ─────────────────────────────────────────── */}
      {compare && sceneB && match && (
        <div style={styles.agreeStrip}>
          <button
            style={chipStyle(filter === "all")}
            onClick={() => setFilter("all")}
          >
            All
            <span style={{ fontFamily: T.mono, marginLeft: 6 }}>
              {boundaries.length}
            </span>
          </button>
          <button
            style={chipStyle(filter === "both")}
            onClick={() => setFilter("both")}
          >
            Matched
            <span style={{ fontFamily: T.mono, marginLeft: 6 }}>
              {match.pairs.length}
            </span>
          </button>
          <button
            style={chipStyle(filter === "A")}
            onClick={() => setFilter("A")}
          >
            Only A
            <span style={{ fontFamily: T.mono, marginLeft: 6 }}>
              {match.onlyA.length}
            </span>
          </button>
          <button
            style={chipStyle(filter === "B")}
            onClick={() => setFilter("B")}
          >
            Only B
            <span style={{ fontFamily: T.mono, marginLeft: 6 }}>
              {match.onlyB.length}
            </span>
          </button>
          <span style={{ flex: 1 }} />
          <span
            style={{ fontSize: 10.5, color: T.textDim, whiteSpace: "nowrap" }}
          >
            observed at σ {activeSigma.toFixed(2)} · chips highlight, don't hide
          </span>
        </div>
      )}

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div style={styles.body}>
        {!sceneA ? (
          <div style={styles.empty}>
            {noBrainKeys ? (
              <p>Compute a brain key first.</p>
            ) : (
              <p>No embeddings found for this scene under "{brainA}".</p>
            )}
          </div>
        ) : view === "timeline" ? (
          <div
            style={{
              padding: "13px 16px 6px",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
                flexWrap: "wrap",
              }}
            >
              <div style={{ ...segWrap, borderRadius: 7, padding: 2 }}>
                <button style={segBtn(!jm)} onClick={() => setMetric("scene")}>
                  Scene shift
                </button>
                <button style={segBtn(jm)} onClick={() => setMetric("jump")}>
                  Jump
                </button>
              </div>
              <span
                style={{ fontSize: 11, color: T.textDim, whiteSpace: "nowrap" }}
              >
                {jm
                  ? "jump · frame-to-frame cosine distance"
                  : sceneShiftMissing
                  ? "no scene-shift data — re-run Compute to populate it"
                  : "scene shift · window-centroid cosine distance"}
              </span>
              <span style={legendStyle}>
                <span
                  style={{
                    width: 10,
                    height: 2,
                    background: COLOR_A,
                    display: "inline-block",
                  }}
                />
                {brainA}
              </span>
              {sceneB && (
                <span style={legendStyle}>
                  <span
                    style={{
                      width: 10,
                      height: 2,
                      background: COLOR_B,
                      display: "inline-block",
                    }}
                  />
                  {brainB}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: T.textDim }}>
                drag ┄ to set σ · click to seek · ←→ step
              </span>
            </div>
            {seriesA && (
              <TimelineChart
                a={seriesA}
                b={seriesB}
                sigma={activeSigma}
                cursorFrame={activeFrame}
                onSeek={handleSeek}
                onSigma={setActiveSigma}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              padding: "13px 16px 8px",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>
                Embedding trajectory
              </span>
              <span style={{ fontSize: 11, color: T.textDim }}>
                2-D projection ·{" "}
                <span style={{ fontFamily: T.mono }}>{trajSceneKey}</span> ·
                trail = last {win} fr · red rings = jumps
              </span>
              <span style={{ flex: 1 }} />
              {compare && sceneB && (
                <div style={{ ...segWrap, borderRadius: 7, padding: 2 }}>
                  <button
                    style={segBtn(trajModel === "A")}
                    onClick={() => setTrajModel("A")}
                  >
                    A
                  </button>
                  <button
                    style={segBtn(trajModel === "B")}
                    onClick={() => setTrajModel("B")}
                  >
                    B
                  </button>
                </div>
              )}
            </div>
            {trajScene && trajDerived && (
              <TrajectoryChart
                points={trajScene.points}
                frames={trajScene.frame_numbers}
                sceneOf={trajDerived.sceneOf}
                scenePeaks={trajDerived.scenePeaks}
                jumpPeaks={trajDerived.jumpPeaks}
                cursorIdx={trajDerived.cursorIdx}
                win={win ?? 120}
                onSeek={handleSeek}
              />
            )}
          </div>
        )}

        {/* ── Alignment band ───────────────────────────────────────── */}
        {sceneA && (
          <div
            style={{
              padding: "10px 16px 6px",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: T.text,
                  whiteSpace: "nowrap",
                }}
              >
                {jm ? "Segments between jumps" : "Scenes"}
              </span>
              {sceneB && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: T.textDim,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                >
                  connected notches = boundaries matched within ±{tol} fr ·
                  dangling = unmatched
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 10.5,
                  color: T.textDim,
                  whiteSpace: "nowrap",
                }}
              >
                cuts at σ {activeSigma.toFixed(2)}
              </span>
            </div>
            <AlignmentBand
              a={{ frames: sceneA.frame_numbers, peaks: peaksA }}
              b={sceneB ? { frames: sceneB.frame_numbers, peaks: peaksB } : null}
              match={match}
              neutral={jm}
              cursorFrame={activeFrame}
              fMin={fMin}
              fMax={fMax}
            />
          </div>
        )}

        {/* ── Boundaries rail ──────────────────────────────────────── */}
        {sceneA && (
          <BoundariesRail
            label={jm ? "Jump frames" : "Boundaries"}
            items={boundaries}
            filter={filter ?? "all"}
            selectedFrame={selectedFrame ?? null}
            media={media}
            onSeek={handleSeek}
          />
        )}

        {/* ── Context filmstrip ────────────────────────────────────── */}
        {sceneA && film.length > 0 && (
          <Filmstrip
            frames={film}
            centerFrame={activeFrame ?? 0}
            ctx={ctx ?? 2}
            media={media}
            onSeek={handleSeek}
          />
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div style={styles.status}>
        <span>{statusL}</span>
        <span>{statusR}</span>
      </div>
    </div>
  );
}

const legendStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: T.mono,
  fontSize: 10.5,
  color: T.textMuted,
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: T.textSoft,
        }}
      >
        <span>{label}</span>
        <span style={{ fontFamily: T.mono, color: T.text }}>
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: T.accentSoft }}
      />
    </div>
  );
}

export default function TemporalEmbeddingTrajectoryView(
  props: TrajectoryViewProps
) {
  const panelContext = usePanelContext();
  const panelId = panelContext?.node?.id;
  if (!panelId) return null;

  return (
    <Suspense fallback={<div style={styles.empty}>Loading…</div>}>
      <TemporalEmbeddingTrajectoryReady {...props} />
    </Suspense>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: 0,
    background: T.bg,
    color: T.text,
    fontFamily: T.sans,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    padding: "11px 16px",
    borderBottom: `1px solid ${T.border}`,
  },
  modelPick: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  agreeStrip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    borderBottom: `1px solid ${T.border}`,
    background: T.bgSub,
  },
  settings: {
    position: "absolute",
    right: 0,
    top: 36,
    zIndex: 40,
    width: 264,
    background: T.bgRaised,
    border: "1px solid #2e3338",
    borderRadius: 9,
    padding: 14,
    boxShadow: "0 14px 34px rgba(0,0,0,.5)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  compute: {
    cursor: "pointer",
    padding: "7px 18px",
    borderRadius: 7,
    border: "none",
    background: T.accent,
    color: "#fff",
    fontFamily: T.sans,
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: ".3px",
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "rgba(170,170,190,.85)",
    fontSize: 13,
    textAlign: "center",
    padding: 16,
  },
  cta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: "100%",
    padding: 24,
    textAlign: "center",
  },
  status: {
    display: "flex",
    justifyContent: "space-between",
    padding: "7px 16px",
    background: "#121417",
    borderTop: `1px solid ${T.border}`,
    fontFamily: T.mono,
    fontSize: 10.5,
    color: "#737b83",
  },
};
