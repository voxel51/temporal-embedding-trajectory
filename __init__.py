"""
Temporal Embedding Trajectory plugin.

Standalone packaging of the Temporal Embedding Trajectory panel: visualizes
per-frame embeddings of a video scene as a 2D scatter (UMAP) with a trajectory
polyline, jump markers, scene-shift segmentation, and a model-comparison view.

The Python Panel renders a ``composite_view`` React component named
``TemporalEmbeddingTrajectoryView``; that component is provided by the bundled
JS plugin (``dist/index.umd.js``), which self-registers it on load.

| Copyright 2017-2026, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""

from .panel_v0_3_1 import TemporalEmbeddingTrajectoryPanel
from .operators_v0_3_1 import ComputeTrajectoryEmbeddings


def register(p):
    p.register(TemporalEmbeddingTrajectoryPanel)
    p.register(ComputeTrajectoryEmbeddings)
