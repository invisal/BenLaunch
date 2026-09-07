/** Seed body for a brand-new QuickValue, shown in the code editor on create. */
export const DEFAULT_CODE = `// TypeScript. Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
module.exports = async function (): Promise<{ value: number }> {
  const res = await fetch("https://api.github.com/repos/nodejs/node")
  const data = (await res.json()) as { stargazers_count: number }
  return { value: data.stargazers_count }
}
`;
