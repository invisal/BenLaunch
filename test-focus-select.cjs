const { _electron: electron } = require('playwright')

async function main() {
  const app = await electron.launch({
    args: ['C:\\Users\\invisal\\Desktop\\Works\\benpocket-launcher\\out\\main\\index.js'],
    cwd: 'C:\\Users\\invisal\\Desktop\\Works\\benpocket-launcher'
  })

  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.show()
  })
  await new Promise((r) => setTimeout(r, 300))

  await win.fill('input', 'some query text')
  await win.evaluate(() => document.querySelector('input')?.blur())
  await new Promise((r) => setTimeout(r, 100))

  // Simulate the OS window losing then regaining focus (pinned so it won't hide).
  await win.click('button:has-text("Pin")')
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].blur()
  })
  await new Promise((r) => setTimeout(r, 150))
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].focus()
  })
  await new Promise((r) => setTimeout(r, 200))

  const state = await win.evaluate(() => {
    const input = document.querySelector('input')
    return {
      isActiveElement: document.activeElement === input,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
      value: input.value
    }
  })
  console.log(JSON.stringify(state, null, 2))

  await app.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
