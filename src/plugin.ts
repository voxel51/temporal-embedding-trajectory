import { registerComponent, PluginComponentType } from "@fiftyone/plugins";
import TemporalEmbeddingTrajectoryView from "./components/TemporalEmbeddingTrajectoryView";

// Standalone-plugin entry point. The UMD bundle built from this file
// self-registers the React view so a packaged FiftyOne plugin (Python
// Panel with `component="TemporalEmbeddingTrajectoryView", composite_view=True`)
// can render it. The component is resolved by name from the
// PluginComponentType.Component registry — see DynamicIO `useCustomComponents`.
//
// `src/index.ts` (plain export) remains the entry the in-monorepo app uses via
// its SchemaIO components index, so the built-in path is unaffected.
registerComponent({
  name: "TemporalEmbeddingTrajectoryView",
  label: "Temporal Embedding Trajectory",
  component: TemporalEmbeddingTrajectoryView,
  type: PluginComponentType.Component,
  activator: () => true,
});
