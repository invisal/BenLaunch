#!/usr/bin/env node
//
// `index.js`/`index.d.ts` in this package are hand-written, not auto-generated
// by `napi build` — see the header comment in `index.js` for why (Linux cross-
// compilation from macOS/Windows isn't set up yet). Running `napi build` on a
// non-Linux host regenerates (and destroys) that hand-written fallback, which
// is exactly how it ended up needing to be hand-written in the first place.
//
// This guard makes `npm install` / `npm run build` a safe no-op everywhere
// except an actual Linux host, so a stray `npm install` from this directory
// (or a future automated cross-platform install step) can't wipe it out again.
// Once this is built for real on Linux, `napi build` can replace both files
// with the auto-generated versions and this guard stops mattering.

if (process.platform !== 'linux') {
  console.log(
    '[@benpocket/linux] Skipping napi build: not running on Linux.\n' +
      '  index.js/index.d.ts here are hand-written — running `napi build`\n' +
      '  outside of an actual Linux host would overwrite them. Build this\n' +
      '  package on a real Linux machine (or CI runner) instead.',
  )
  process.exit(0)
}

const { execFileSync } = require('child_process')

execFileSync('napi', ['build', '--platform', ...process.argv.slice(2)], { stdio: 'inherit' })
