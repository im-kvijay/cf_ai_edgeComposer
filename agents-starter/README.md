# EdgeComposer

AI-powered CDN configuration tool built on Cloudflare Workers.

## Features

- **AI Generation** - Describe your CDN needs in plain English, get production-ready rules
- **Playbooks** - Pre-built configurations for common scenarios (E-commerce, Blog, API, Static)
- **Version Control** - Track changes, rollback to previous versions
- **Preview Tokens** - Test configurations before promoting to production
- **Real-time Insights** - Risk assessment, validation warnings, and AI-generated summaries

## Tech Stack

- **Runtime**: Cloudflare Workers + Durable Objects
- **AI**: Workers AI (Llama 3.3 70B)
- **Frontend**: React 19, Vite 7, Tailwind CSS 4
- **Language**: TypeScript

## Getting Started

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Architecture

```
src/
├── api/           # API client
├── components/    # React components
│   ├── actions/   # Action bar
│   ├── chat/      # Chat interface
│   ├── common/    # Shared UI (Button, Card, Modal, Toast, etc.)
│   ├── dashboard/ # Main panels (Rules, Versions, Tokens, Playbooks)
│   ├── layout/    # Header, Sidebar, Panel
│   ├── rules/     # Rule cards and filters
│   └── settings/  # Settings modal
├── hooks/         # React hooks (usePlan, useVersions, useTokens, etc.)
├── types/         # TypeScript definitions
├── utils/         # Formatters, helpers
├── server.ts      # Worker entry point
├── cdn-tools.ts   # AI-callable CDN tools
└── config-do.ts   # Durable Object for state
```

## Rule Types

| Type | Description |
|------|-------------|
| `cache` | Cache rules with TTL |
| `header` | Add/remove/modify headers |
| `route` | Redirects, rewrites, proxies |
| `rate-limit` | API rate limiting |
| `security` | HSTS, CSP, XFO headers |
| `performance` | Compression, minification |
| `canary` | Traffic splitting |
| `banner` | Inject banners into HTML |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Generate rules from prompt |
| `/api/active` | GET | Get active plan version |
| `/api/draft` | GET | Get draft plan |
| `/api/promote` | POST | Promote draft to active |
| `/api/rollback` | POST | Rollback to previous version |
| `/api/versions` | GET | List all versions |
| `/api/tokens` | GET | List preview tokens |
| `/api/token` | POST | Create preview token |

## License

MIT
