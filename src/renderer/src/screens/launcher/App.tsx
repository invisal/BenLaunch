import { LauncherHostProvider } from "./host";
import { RouteStackProvider } from "./router/context";
import { RouteStackOutlet } from "./router/Outlet";

/**
 * The launcher window shell. All of the search UI lives in `LauncherScreen`; it
 * is just the root entry of a navigation stack, and screens pushed on top of it
 * (Create / Edit / Duplicate Quicklink, …) render through `RouteStackOutlet`.
 * See `router/` for how the stack works and `host.tsx` for the state shared
 * across screens.
 */
function App() {
  return (
    <LauncherHostProvider>
      <RouteStackProvider>
        <RouteStackOutlet />
      </RouteStackProvider>
    </LauncherHostProvider>
  );
}

export default App;
