// Vite's renderer `root` is `src/renderer`, so each window's HTML entry can only
// point at a script *inside* that root. This one-line bridge re-exports the real
// entry, which lives with the rest of the feature in the QuickValue extension.
import "@extensions/quickvalue/renderer/main";
