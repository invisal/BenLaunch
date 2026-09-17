/** Seed body for a brand-new "From Scratch" Widget — the minimal boilerplate, no API call. */
export const DEFAULT_CODE = `// TypeScript. Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
module.exports = async function (): Promise<Result> {
  return { value: null }
}
`;
