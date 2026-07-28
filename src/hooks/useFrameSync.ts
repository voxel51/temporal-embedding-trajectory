import { useCallback, useEffect, useRef, useState } from "react";
import {
  dispatchTimelineSetFrameNumberEvent,
  useDefaultTimelineNameImperative,
  useTimeline,
} from "@fiftyone/playback";

const SUBSCRIPTION_ID = "temporal-embedding-trajectory-cursor";

/**
 * Bidirectional sync with the active video timeline.
 *
 * - Reads: subscribes to frame updates via useTimeline so the panel
 *   re-renders when the user scrubs the video.
 * - Writes: returns a `seekFrame` callback that drives the *video element*
 *   via dispatchTimelineSetFrameNumberEvent. The plain setFrameNumberAtom
 *   only updates Jotai subscribers (us, but not the looker), so we have
 *   to fire the DOM CustomEvent the looker listens for to actually move
 *   the playhead. The atom catches up via the looker's own callback
 *   once it has seeked.
 *
 * Returns null currentFrame when there's no active timeline (e.g.
 * panel is open in grid mode without a modal video).
 */
export function useFrameSync() {
  const { getName } = useDefaultTimelineNameImperative();
  const timelineName = getName();

  const { subscribe, isTimelineInitialized } = useTimeline(timelineName);

  const [currentFrame, setCurrentFrame] = useState<number | null>(null);
  const currentFrameRef = useRef<number | null>(null);
  currentFrameRef.current = currentFrame;

  const renderFrame = useCallback((frameNumber: number) => {
    if (currentFrameRef.current !== frameNumber) {
      setCurrentFrame(frameNumber);
    }
  }, []);

  useEffect(() => {
    if (!isTimelineInitialized) return;
    subscribe({
      id: SUBSCRIPTION_ID,
      loadRange: async () => {
        /* nothing to preload — points are already in memory */
      },
      renderFrame,
    });
  }, [isTimelineInitialized, subscribe, renderFrame]);

  const seekFrame = useCallback(
    (frameNumber: number, totalFrames?: number) => {
      // Path 1 — imavid (image-sequence) lookers: these are driven by the
      // frame-based Timeline, which listens for this DOM CustomEvent.
      if (timelineName) {
        dispatchTimelineSetFrameNumberEvent({
          timelineName,
          newFrameNumber: frameNumber,
        });
      }

      // Path 2 — native <video> lookers: a real MP4 is driven by the
      // separate continuous-time playback engine, NOT the Timeline, so the
      // event above never reaches it (that's why sync was one-way). Seek
      // the element directly. This is deliberately version-agnostic — it
      // depends only on there being an HTML5 <video> in the modal, so it
      // works across FiftyOne releases regardless of their playback engine.
      try {
        const root: ParentNode =
          document.querySelector('[data-cy="modal"]') ?? document;
        const video = Array.from(root.querySelectorAll("video")).find(
          (v) =>
            Number.isFinite(v.duration) &&
            v.duration > 0 &&
            // visible element (skip detached/grid off-screen videos)
            v.offsetParent !== null
        );
        if (video && totalFrames && totalFrames > 0) {
          // frames are 1-indexed and consecutive; fps = totalFrames /
          // duration, so t = (frame - 1) / fps. Seek fraction avoids
          // needing the exact fps from the payload.
          const t = ((frameNumber - 1) / totalFrames) * video.duration;
          if (Math.abs(video.currentTime - t) > 1e-3) {
            video.currentTime = Math.min(
              video.duration,
              Math.max(0, t)
            );
          }
        }
      } catch {
        /* DOM shape differs across releases — timeline path still applies */
      }
    },
    [timelineName]
  );

  return {
    currentFrame,
    seekFrame,
    timelineName,
    isTimelineActive: isTimelineInitialized,
  };
}
