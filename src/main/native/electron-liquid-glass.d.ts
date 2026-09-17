/**
 * `electron-liquid-glass` is published with `os: ["darwin"]`, so npm never
 * installs it on Windows/Linux — its real `dist/index.d.ts` isn't there for
 * `tsc` to resolve. This hand-copied declaration (matching the package's
 * published types) lets typecheck work on every platform. Keep in sync if
 * the installed version is ever bumped.
 */
declare module 'electron-liquid-glass' {
  interface GlassOptions {
    cornerRadius?: number
    tintColor?: string
    opaque?: boolean
  }

  interface LiquidGlassNative {
    addView(handle: Buffer, options: GlassOptions): number
    setVariant(id: number, variant: number): void
    setScrimState(id: number, scrim: number): void
    setSubduedState(id: number, subdued: number): void
  }

  class LiquidGlass {
    isGlassSupported(): boolean
    addView(handle: Buffer, options?: GlassOptions): number
    unstable_setVariant(id: number, variant: number): void
    unstable_setScrim(id: number, scrim: number): void
    unstable_setSubdued(id: number, subdued: number): void
  }

  const liquidGlass: LiquidGlass
  export { GlassOptions, LiquidGlassNative }
  export default liquidGlass
}
