# Temporal Embedding Trajectory

A [FiftyOne](https://github.com/voxel51/fiftyone) panel for analyzing **per-frame
embedding trajectories** of videos. It plots every frame of a video as a point in
embedding space (UMAP) so you can see, at a glance, where a model's understanding
of the scene shifts — useful for finding the exact frames where something changes
(lighting, occlusion, a new object, a false detection).

## Views

- **Scatter** — every frame as a point, a recent-trajectory polyline, and red
  "jump" markers on frames where the embedding moved sharply (scene-change
  candidates).
- **Segments** — the scatter colored by scene-shift–derived segment membership;
  surfaces cluster structure and "out of place" frames (anomalies).
- **Compare** — two models' per-frame jump distance on one axis. Frames where both
  models spike together are high-confidence scene changes.
- **Scenes** — windowed scene-shift score with detected boundaries.

## Install

### FiftyOne Teams / Enterprise

Settings → Plugins → **Install plugin** → upload a ZIP of this repository. Or via
the Management SDK:

```python
import fiftyone.management as fom
fom.upload_plugin("/path/to/temporal-embedding-trajectory")  # dir or .zip
```

### FiftyOne OSS

```bash
fiftyone plugins download https://github.com/voxel51/temporal-embedding-trajectory
```

or copy this directory into your `FIFTYONE_PLUGINS_DIR`.

## Requirements

See [`requirements.txt`](requirements.txt). `numpy` + `fiftyone-brain` are required;
`umap-learn` for the default UMAP method (PCA / t-SNE need no extra dependency).
Computing **new** embeddings with the built-in CLIP / DINOv2 zoo models also needs
`torch` + `torchvision` — not needed if you project an existing per-frame
embeddings field.

## Usage

1. Open a **video** dataset and open the **Temporal Embedding Trajectory** panel.
2. Click **Compute** (choose a model + dimensionality-reduction method). This runs
   the `compute_trajectory_embeddings` operator, which embeds frames, projects them
   to 2D, and writes `<brain_key>_jump_dist` / `<brain_key>_scene_shift` frame
   fields.
3. Select the computed brain key and explore the Scatter / Segments / Compare /
   Scenes views. Video playback drives the yellow current-frame cursor.

## How it works

- **Python** ([`panel.py`](panel.py), [`operators.py`](operators.py)): a
  `Panel` that renders a `composite_view` React component named
  `TemporalEmbeddingTrajectoryView`, plus the `compute_trajectory_embeddings`
  operator. `jump_dist(t)` is the cosine distance between consecutive frame
  embeddings; `scene_shift(t)` is the cosine distance between the mean of the
  previous `W` frames and the next `W` (the windowed boundary score).
- **JavaScript** ([`src/`](src)): the React views, bundled to
  [`dist/index.umd.js`](dist/index.umd.js). The bundle self-registers the
  component and externalizes the FiftyOne app's runtime globals (React, recoil,
  `@fiftyone/*`).

## Development

The JS bundle is **prebuilt and committed** (`dist/index.umd.js`), so no build is
needed to install. To rebuild it you need a local FiftyOne **source** checkout
(the build externalizes `@fiftyone/*` and resolves them at build time):

```bash
# 1. Clone fiftyone next to this repo and install/build the app once
#    https://github.com/voxel51/fiftyone  (see its app/ README)

# 2. Link the FiftyOne app packages, then build
export FIFTYONE_DIR=/path/to/fiftyone
yarn install
yarn link "$FIFTYONE_DIR/app" --all --private --relative
yarn build          # -> dist/index.umd.js (IIFE, externalizes the app globals)
```

The bundle **must** be built against `@fiftyone` package APIs matching the FiftyOne
release your deployment runs; keep `fiftyone.version` in
[`fiftyone.yml`](fiftyone.yml) aligned.

## License

Apache 2.0
