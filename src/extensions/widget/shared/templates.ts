import { DEFAULT_CODE } from "./default-code";

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

const GITHUB_STARS_CODE = `// TypeScript. Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
// Edit the owner/repo below to track a different repository.
module.exports = async function (): Promise<Result> {
  const res = await fetch("https://api.github.com/repos/nodejs/node")
  const data = (await res.json()) as { stargazers_count: number }
  return { value: data.stargazers_count }
}
`;

const DIGITALOCEAN_BILLING_CODE = `// TypeScript. Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
// Create a read-scoped token at https://cloud.digitalocean.com/account/api/tokens
const DIGITALOCEAN_TOKEN = "YOUR_DIGITALOCEAN_TOKEN"

module.exports = async function (): Promise<Result> {
  const res = await fetch("https://api.digitalocean.com/v2/customers/my/balance", {
    headers: { Authorization: \`Bearer \${DIGITALOCEAN_TOKEN}\` }
  })
  const data = (await res.json()) as { account_balance: string }
  return { value: \`$\${data.account_balance}\` }
}
`;

const CLOUDFLARE_BILLING_CODE = `// TypeScript. Return an object shaped { value: string | number | null }.
// This runs in a background Node process, so fetch() and require() are available.
// Create a token with "Billing Read" permission at https://dash.cloudflare.com/profile/api-tokens
const CLOUDFLARE_API_TOKEN = "YOUR_CLOUDFLARE_API_TOKEN"
const CLOUDFLARE_ACCOUNT_ID = "YOUR_CLOUDFLARE_ACCOUNT_ID"

module.exports = async function (): Promise<Result> {
  const res = await fetch(
    \`https://api.cloudflare.com/client/v4/accounts/\${CLOUDFLARE_ACCOUNT_ID}/billable-usage\`,
    { headers: { Authorization: \`Bearer \${CLOUDFLARE_API_TOKEN}\` } }
  )
  const data = (await res.json()) as { result: { CumulatedContractedCost: number }[] }
  const total = data.result.reduce((sum, item) => sum + item.CumulatedContractedCost, 0)
  return { value: \`$\${total.toFixed(2)}\` }
}
`;

/**
 * Starting points offered by the Template field on `MetaScreen` (create only).
 * "From Scratch" seeds `DEFAULT_CODE` — the same minimal boilerplate every new
 * Widget used to get unconditionally.
 */
export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: "blank",
    name: "From Scratch",
    description: "Minimal boilerplate — write your own snippet.",
    code: DEFAULT_CODE,
  },
  {
    id: "github-stars",
    name: "GitHub Stars",
    description: "Star count for a GitHub repository.",
    code: GITHUB_STARS_CODE,
  },
  {
    id: "digitalocean-billing",
    name: "DigitalOcean Billing",
    description: "Current account balance from DigitalOcean.",
    code: DIGITALOCEAN_BILLING_CODE,
  },
  {
    id: "cloudflare-billing",
    name: "Cloudflare Billing",
    description: "Month-to-date billable usage cost for a Cloudflare account.",
    code: CLOUDFLARE_BILLING_CODE,
  },
];

export function getWidgetTemplate(id: string | undefined): WidgetTemplate {
  return WIDGET_TEMPLATES.find((template) => template.id === id) ?? WIDGET_TEMPLATES[0];
}
