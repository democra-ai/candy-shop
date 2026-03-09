---
title: Candy Shop
emoji: 🍭
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
---

<div align="center">

<img src="public/favicon.svg" width="80" alt="Candy Shop Logo" />

# Candy Shop

### The Open-Source AI Skill Marketplace

**Discover, match, and trade AI agent skills in a two-sided marketplace.**

[![Live Demo](https://img.shields.io/badge/🤗_HuggingFace-Live_Demo-FFD21E?style=for-the-badge&logo=huggingface&logoColor=000)](https://huggingface.co/spaces/tao-shen/candy-shop)
[![Vercel](https://img.shields.io/badge/Vercel-Production-000?style=for-the-badge&logo=vercel&logoColor=white)](https://candy-shop-three.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/democra-ai/candy-shop?style=for-the-badge&logo=github&color=yellow)](https://github.com/democra-ai/candy-shop/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

[![GitHub release](https://img.shields.io/github/v/release/democra-ai/candy-shop?style=flat-square&label=Latest%20Release)](https://github.com/democra-ai/candy-shop/releases)
[![GitHub Issues](https://img.shields.io/github/issues/democra-ai/candy-shop?style=flat-square)](https://github.com/democra-ai/candy-shop/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/democra-ai/candy-shop/pulls)

[Live Demo](https://candy-shop-three.vercel.app) · [Report Bug](https://github.com/democra-ai/candy-shop/issues) · [Request Feature](https://github.com/democra-ai/candy-shop/issues/new) · [Releases](https://github.com/democra-ai/candy-shop/releases)

</div>

---

## Why Candy Shop?

AI agents are powerful — but finding the right skill for the right task shouldn't be hard.

**Candy Shop** is a two-sided marketplace that connects **skill providers** (Candy Makers) with **skill seekers** (Sweet Tooths). Think of it as a matchmaking platform where AI capabilities meet real-world demands.

| Supply Side | Demand Side |
|:-:|:-:|
| **Candy** | **Craving** |
| AI skills offered by agents | Requests posted by users |
| Browse → Run → Install | Post → Match → Fulfill |

> **240+ curated skills** across 8 categories — ready to use, fork, or extend.

## Key Features

### Two-Sided Marketplace
- **Find Candy** — Browse and search a curated catalog of AI agent skills
- **Find Craving** — Discover open requests from users looking for specific AI capabilities
- **Smart Matching** — Click any skill to find matching cravings, or any craving to find matching skills

### Built-in Skill Executor
Run any skill directly in the browser with a full-featured chat interface powered by [OpenCode](https://github.com/nichochar/opencode). Streaming responses, file attachments, tool use — no setup required.

### Skill Creator
Build and publish your own skills with a visual editor — name, description, system prompt, and parameters. No coding required.

### Cross-Platform
| Platform | Status | Details |
|----------|--------|---------|
| Web (Vercel) | Production | Auto-deploy from `main` |
| Web (HuggingFace) | Production | Docker-based Spaces deployment |
| macOS Desktop | Available | Native app via Tauri v2 |
| Self-hosted | Supported | Docker-ready |

### Theming & i18n
6 color themes with dark/light mode. Full English and Chinese localization.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

### Development

```bash
git clone https://github.com/democra-ai/candy-shop.git
cd candy-shop
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
# Web
pnpm build

# Desktop (macOS)
pnpm tauri build

# Docker
docker build -t candy-shop .
docker run -p 7860:7860 candy-shop
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

See [`.env.example`](.env.example) for required variables.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 · TypeScript · Tailwind CSS |
| Build | Vite 7 |
| Desktop | Tauri v2 (Rust) |
| Auth | Supabase |
| AI | Anthropic SDK · OpenCode SDK |
| Deploy | Vercel · Docker · HuggingFace Spaces |

## Architecture

```
candy-shop/
├── src/
│   ├── components/
│   │   ├── home/              # Hero, SkillsGrid, CravingsGrid, Categories
│   │   ├── layout/            # Sidebar, Layout, Header
│   │   ├── skill-creator/     # Visual skill editor
│   │   └── ui/                # Shared UI primitives
│   ├── contexts/              # Auth, Language, Theme, VersionMode
│   ├── data/                  # Skills & Cravings catalogs
│   ├── lib/                   # API clients (OpenCode, Supabase)
│   └── pages/                 # Route pages
├── src-tauri/                 # Native desktop app (Rust)
├── public/                    # Static assets & illustrations
├── Dockerfile                 # HuggingFace Spaces deployment
└── package.json
```

## Roadmap

- [ ] Backend persistence (Supabase / Postgres)
- [ ] User profiles & reputation system
- [ ] Skill reviews & ratings
- [ ] Revenue sharing for Candy Makers
- [ ] Skill composition (chain multiple skills)
- [ ] API for programmatic skill discovery
- [ ] Windows & Linux desktop builds

## Contributing

Contributions are welcome! Here's how to get involved:

- **Add a skill** — Submit a PR with a new entry in `src/data/skillsData.ts`
- **Fix bugs** — Check [open issues](https://github.com/democra-ai/candy-shop/issues)
- **Improve UI/UX** — Design contributions are always appreciated
- **Translate** — Help us add more languages beyond English and Chinese

## Releases

All desktop app builds and versioned releases are published on the [Releases](https://github.com/democra-ai/candy-shop/releases) page. Download the latest macOS `.dmg` or check the changelog there.

## License

Candy Shop is licensed under the [MIT License](LICENSE).

---

<div align="center">

**AI is simple like candy** 🍬

Built by [Democra AI](https://github.com/democra-ai)

[Live Demo](https://candy-shop-three.vercel.app) · [GitHub](https://github.com/democra-ai/candy-shop) · [Releases](https://github.com/democra-ai/candy-shop/releases) · [Issues](https://github.com/democra-ai/candy-shop/issues)

</div>
