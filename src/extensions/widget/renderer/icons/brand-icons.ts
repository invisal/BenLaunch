// Brand logos offered by the Widget icon picker. The SVGs are static assets in
// src/renderer/public/brand-icons/<id>.svg — to add or remove a brand, add or
// delete the file and its row here.

export interface BrandIcon {
  /** File name (without .svg) under `public/brand-icons/`. */
  id: string;
  name: string;
  keywords: string;
}

export const BRAND_ICONS: BrandIcon[] = [
  { id: "aws", name: "AWS", keywords: "amazon web services cloud" },
  { id: "microsoft-azure", name: "Azure", keywords: "microsoft cloud" },
  { id: "google-cloud", name: "Google Cloud", keywords: "gcp cloud" },
  {
    id: "digital-ocean-icon",
    name: "DigitalOcean",
    keywords: "droplet cloud hosting",
  },
  { id: "cloudflare-icon", name: "Cloudflare", keywords: "cdn dns workers" },
  { id: "vercel-icon", name: "Vercel", keywords: "hosting next deploy" },
  { id: "netlify-icon", name: "Netlify", keywords: "hosting deploy" },
  { id: "heroku-icon", name: "Heroku", keywords: "hosting paas" },
  { id: "fly-icon", name: "Fly.io", keywords: "hosting deploy" },
  { id: "railway", name: "Railway", keywords: "hosting deploy" },
  { id: "linode", name: "Linode", keywords: "akamai hosting vps" },
  { id: "vultr-icon", name: "Vultr", keywords: "hosting vps" },
  { id: "akamai", name: "Akamai", keywords: "cdn" },
  { id: "firebase-icon", name: "Firebase", keywords: "google backend" },
  { id: "supabase-icon", name: "Supabase", keywords: "postgres backend" },
  {
    id: "aws-lambda",
    name: "AWS Lambda",
    keywords: "serverless function amazon",
  },
  { id: "aws-s3", name: "AWS S3", keywords: "storage bucket amazon" },
  { id: "aws-ec2", name: "AWS EC2", keywords: "server instance amazon" },
  { id: "github-icon", name: "GitHub", keywords: "git code repo" },
  { id: "gitlab-icon", name: "GitLab", keywords: "git code repo" },
  { id: "bitbucket", name: "Bitbucket", keywords: "git code repo atlassian" },
  { id: "docker-icon", name: "Docker", keywords: "container" },
  { id: "kubernetes", name: "Kubernetes", keywords: "k8s container" },
  { id: "terraform-icon", name: "Terraform", keywords: "infrastructure iac" },
  { id: "npm-icon", name: "npm", keywords: "node package registry" },
  { id: "nodejs-icon", name: "Node.js", keywords: "javascript runtime" },
  { id: "postgresql", name: "PostgreSQL", keywords: "postgres database sql" },
  { id: "mysql-icon", name: "MySQL", keywords: "database sql" },
  { id: "mongodb-icon", name: "MongoDB", keywords: "database nosql" },
  { id: "redis", name: "Redis", keywords: "cache database" },
  { id: "sentry-icon", name: "Sentry", keywords: "errors monitoring" },
  { id: "datadog-icon", name: "Datadog", keywords: "monitoring metrics" },
  { id: "grafana", name: "Grafana", keywords: "dashboard metrics" },
  { id: "prometheus", name: "Prometheus", keywords: "monitoring metrics" },
  { id: "stripe", name: "Stripe", keywords: "payments billing" },
  { id: "openai-icon", name: "OpenAI", keywords: "ai gpt chatgpt" },
  { id: "anthropic-icon", name: "Anthropic", keywords: "ai claude" },
  { id: "slack-icon", name: "Slack", keywords: "chat messaging" },
  { id: "discord-icon", name: "Discord", keywords: "chat messaging" },
  { id: "telegram", name: "Telegram", keywords: "chat messaging" },
  { id: "whatsapp-icon", name: "WhatsApp", keywords: "chat messaging" },
  { id: "notion-icon", name: "Notion", keywords: "docs notes" },
  { id: "linear-icon", name: "Linear", keywords: "issues tracker" },
  { id: "jira", name: "Jira", keywords: "issues tracker atlassian" },
  { id: "trello", name: "Trello", keywords: "kanban atlassian" },
  { id: "google-gmail", name: "Gmail", keywords: "email google" },
  { id: "google-drive", name: "Google Drive", keywords: "storage files" },
  { id: "google-calendar", name: "Google Calendar", keywords: "schedule" },
  { id: "dropbox", name: "Dropbox", keywords: "storage files" },
  { id: "youtube-icon", name: "YouTube", keywords: "video google" },
  { id: "spotify-icon", name: "Spotify", keywords: "music" },
  { id: "twitter", name: "Twitter", keywords: "social tweet" },
  { id: "x", name: "X", keywords: "social twitter" },
  { id: "linkedin-icon", name: "LinkedIn", keywords: "social" },
  { id: "reddit-icon", name: "Reddit", keywords: "social" },
];
