<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/34419e77-15c9-46f5-b03b-bb0d4a87cc7e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Operations Documentation

| Document | Description |
|---|---|
| [**BizScope Owner Reference**](docs/BIZSCOPE_OWNER_REFERENCE.md) | **START HERE — consolidated owner manual** |
| [ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) | All environment variables — required, optional, scopes, VITE_ warning |
| [DATABASE_OPERATIONS.md](docs/DATABASE_OPERATIONS.md) | Table schemas, read-only SQL queries, safe admin write SQL |
| [BILLING_AND_TRIALS.md](docs/BILLING_AND_TRIALS.md) | Plan tiers, Stripe lifecycle, 7-day trial mechanics, entitlement types |
| [DEPLOYMENT_AND_ROLLBACK.md](docs/DEPLOYMENT_AND_ROLLBACK.md) | Branch model, deployment checklist, smoke test checklist, rollback steps |
| [ANALYTICS_AND_MARKETING.md](docs/ANALYTICS_AND_MARKETING.md) | GA4 events, Clarity masking, UTM attribution, SEO, sitemap |
| [INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md) | 17 incident scenarios with Symptoms / Diagnostics / Safe Actions / Verification |
| [DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md) | Full infrastructure recovery steps, external system backup checklist |
| [OWNER_OPERATIONS_MANUAL.md](docs/OWNER_OPERATIONS_MANUAL.md) | Common owner tasks: user management SQL, feature flags, health checks |
| [DEVELOPER_RUNBOOK.md](docs/DEVELOPER_RUNBOOK.md) | Local setup, architecture quick-map, common change guides, known quirks |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System overview, 6 Mermaid data-flow diagrams, security boundaries |
| [CHANGELOG_OWNER.md](docs/CHANGELOG_OWNER.md) | Operational milestone history grouped by sprint |

### Project History

| Document | Description |
|---|---|
| [history/PROJECT_TIMELINE.md](docs/history/PROJECT_TIMELINE.md) | Key milestones with dates |
| [history/MAJOR_DECISIONS.md](docs/history/MAJOR_DECISIONS.md) | Non-obvious architectural decisions and their rationale |
| [history/SECURITY_FIXES.md](docs/history/SECURITY_FIXES.md) | Security-relevant changes and verification steps |
| [history/LAUNCH_HISTORY.md](docs/history/LAUNCH_HISTORY.md) | Commercial and public launch milestones |
| [history/CLAUDE_PROMPTS_ARCHIVE.md](docs/history/CLAUDE_PROMPTS_ARCHIVE.md) | Curated summaries of Claude-assisted development sessions |
| [history/CHATGPT_CONTEXT_ARCHIVE.md](docs/history/CHATGPT_CONTEXT_ARCHIVE.md) | Curated summaries of ChatGPT-assisted development sessions |
