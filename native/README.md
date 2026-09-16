# Native packages

The directories in this folder are private [NAPI-RS](https://napi.rs/) packages used by the Electron app:

| Package | Platform | Native integration |
| --- | --- | --- |
| `native/mac` | macOS | Window discovery, positioning, and fullscreen through CoreGraphics and Accessibility APIs |
| `native/win` | Windows | Win32 window operations and application icon extraction |
| `native/linux` | Linux | X11/XWayland window discovery, positioning, and fullscreen through EWMH |

The root `package.json` references all three packages as optional file dependencies. npm selects the package whose `os` field matches the host platform, so normal development starts from the repository root.

## Prerequisites

All platforms need:

- Node.js and npm
- Rust and Cargo (`rustup` is recommended)
- The repository's JavaScript dependencies installed with `npm install`
- The NAPI-RS CLI, installed by the root project's dev dependencies

Install the common dependencies from the repository root:

```sh
npm install
```

The native packages use Rust 2024 edition and NAPI version 9 bindings. Their `Cargo.lock` files are committed, so native builds should use the locked dependency versions when reproducibility matters.

## Build the package for the current host

Run the command from the package directory:

```sh
cd native/mac       # or native/win or native/linux
npm run build
```

The package scripts are convenience aliases around the NAPI-RS CLI:

```sh
npm run build          # release build
npm run build:debug    # debug build
npm install            # runs the package's install build hook
```

The release command is equivalent to:

```sh
npx napi build --platform --release
```

Build the package on the operating system it targets. The package manifests currently declare these targets:

- macOS: `aarch64-apple-darwin` and `x86_64-apple-darwin`
- Windows: `x86_64-pc-windows-msvc`
- Linux: `x86_64-unknown-linux-gnu` and `aarch64-unknown-linux-gnu`

The resulting `*.node` file is written into the package directory and is loaded by that package's `index.js`.

## Platform requirements

### macOS

Build on macOS with the Xcode Command Line Tools installed:

```sh
xcode-select --install
cd native/mac
npm run build
```

The Rust build links the Apple `ApplicationServices`, `CoreGraphics`, and `AppKit` frameworks. At runtime, macOS must grant the application Accessibility permission:

1. Open **System Settings > Privacy & Security > Accessibility**.
2. Add and enable the application that runs the launcher.

Without that permission, the native module can load but focused-window reads and window changes may return no result.

### Windows

Build on Windows using the MSVC Rust toolchain and Visual Studio Build Tools with the **Desktop development with C++** workload:

```powershell
rustup default stable-x86_64-pc-windows-msvc
cd native\win
npm run build
```

The package uses Win32, COM, Shell, GDI, and DWM APIs. The GNU Rust target is not the declared target for this package; use `x86_64-pc-windows-msvc`.

### Linux

Build on a glibc-based Linux system with a working X11 development/runtime environment:

```sh
cd native/linux
npm run build
```

The Rust code uses `x11rb`, so no `libxcb` development package is required. The module still needs an X11 display connection at runtime. XWayland-backed windows work under Wayland, but native Wayland windows cannot be moved or resized by this package. Alpine and other musl-based systems are not supported by the current loader; use glibc.

The Linux package intentionally skips `napi build` when the host is not Linux. This protects the hand-written `index.js` and `index.d.ts` loader from being overwritten by an unsupported cross-build:

```text
[@magibar/linux] Skipping napi build: not running on Linux.
```

Do not remove `native/linux/scripts/guard-build.js` unless Linux cross-compilation and loader generation have been set up. To produce or refresh Linux binaries, use a real Linux machine or CI runner for each declared architecture.

## Root project workflow

From the repository root, the normal workflow is:

```sh
npm install
npm run dev
```

When npm installs the root project, it resolves the matching optional native dependency and runs that package's install hook:

```sh
npm install
```

The root `npm run build` only builds the Electron application. To explicitly rebuild the native package, run `npm run build` (or `npx napi build --platform --release`) from the relevant `native/<platform>` directory.

To build a distributable Windows application, use the existing root script from a Windows environment:

```sh
npm run dist
```

The root `dist` scripts currently pass `--win` to electron-builder. macOS and Linux distributables need their own electron-builder configuration/commands before release packaging for those platforms.

## Generated files and source changes

Keep these files with the native package when a build produces them:

- `*.node` native binaries
- `index.js` and `index.d.ts` generated by NAPI-RS, unless the package explicitly documents a hand-written loader

The macOS and Windows loaders are generated by NAPI-RS. The Linux loader is currently hand-written and must not be regenerated from macOS or Windows. When changing Rust exports, update the matching TypeScript declarations and package loader as needed, then build and test on the target operating system.

## Troubleshooting

### `napi: command not found`

Install dependencies from the repository root and retry:

```sh
npm install
```

### Native module cannot be loaded

Check that the `*.node` file matches both the operating system and CPU architecture. Remove stale native output and rebuild on the target host:

```sh
rm -rf native/<platform>/target native/<platform>/*.node
cd native/<platform>
npm run build
```

On Windows, use PowerShell equivalents for file removal.

### Linux reports that no X11 window is available

Confirm that `DISPLAY` is set and that an X11 server or XWayland is running. A pure Wayland session with no XWayland windows cannot be controlled by this package.