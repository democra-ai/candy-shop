---
title: Candy Shop
emoji: 🍭
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
---

<div align="center">

# 🍭 Candy Shop

**The Open-Source AI Skill Marketplace**

Browse, run, create, and share AI agent skills — all in one place.

[![Live Demo](https://img.shields.io/badge/🤗_HuggingFace-Live_Demo-yellow?style=for-the-badge)](https://huggingface.co/spaces/tao-shen/candy-shop)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)](https://candy-shop-three.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Source_Code-black?style=for-the-badge&logo=github)](https://github.com/democra-ai/candy-shop)

</div>

---

## What is Candy Shop?

Candy Shop is an open-source marketplace for **AI agent skills** — reusable prompt instructions (defined in `SKILL.md` files) that give AI agents like Claude Code specialized capabilities. Think of it as an app store, but for AI skills.

- **230+ curated skills** across 8 categories
- **Run skills instantly** in the built-in agent executor
- **Create your own skills** with a visual editor
- **Community-driven** — contribute skills via GitHub PRs

## Features

### Skill Marketplace
Browse and search a curated collection of AI skills organized into categories: Development, Design, Tools, Marketing, Mobile, Productivity, Research, and Writing.

### Built-in Skill Executor
Run any skill directly in the browser with a full-featured chat interface powered by [OpenCode](https://github.com/nichochar/opencode). Supports streaming responses, file attachments, tool use, and interactive Q&A.

### Skill Creator
Build and publish your own skills with a name, description, system prompt, and configuration — no coding required.

### Multi-Platform
- **Web (Vercel)** — Production frontend on [Vercel](https://candy-shop-three.vercel.app) with automatic deploys
- **Web (HuggingFace)** — Also on [HuggingFace Spaces](https://huggingface.co/spaces/tao-shen/candy-shop) via Docker
- **Desktop** — Native macOS app built with [Tauri v2](https://v2.tauri.app)
- **Self-hosted** — Docker-ready for your own infrastructure

### Theming & i18n
6 color themes (Indigo, Ocean, Emerald, Sunset, Rose, Purple) with dark/light mode. Full English and Chinese localization.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

### Development

```bash
# Clone the repository
git clone https://github.com/democra-ai/candy-shop.git
cd candy-shop

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
pnpm build
```

### Docker (HuggingFace Spaces)

```bash
docker build -t candy-shop .
docker run -p 7860:7860 candy-shop
```

### Desktop App (Tauri)

```bash
pnpm tauri build
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS |
| Build | Vite 7 |
| Desktop | Tauri v2 (Rust) |
| Auth | Supabase |
| AI SDK | Anthropic SDK, OpenCode SDK |
| Deployment | Docker, HuggingFace Spaces, Vercel |

## Project Structure

```
candy-shop/
├── src/
│   ├── components/       # React components
│   │   ├── home/         # Landing page sections (Hero, FAQ, etc.)
│   │   ├── skill-creator/# Skill creator & executor
│   │   └── ui/           # Shared UI components
│   ├── contexts/         # React contexts (Auth, Language, Theme)
│   ├── data/             # Skills catalog data
│   └── lib/              # API clients (OpenCode, Supabase)
├── src-tauri/            # Tauri native app config
├── public/               # Static assets & illustrations
├── Dockerfile            # HuggingFace Spaces deployment
└── package.json
```

## Contributing

Contributions are welcome! Here are some ways to get involved:

- **Add a skill** — Submit a PR with a new skill entry in `src/data/skillsData.ts`
- **Fix bugs** — Check the [Issues](https://github.com/democra-ai/candy-shop/issues) tab
- **Improve UI/UX** — Design contributions are always appreciated
- **Translate** — Help us add more languages

## License

MIT

---

<div align="center">

**AI is simple like candy** 🍬

[Live Demo](https://huggingface.co/spaces/tao-shen/candy-shop) · [GitHub](https://github.com/democra-ai/candy-shop) · [Report Bug](https://github.com/democra-ai/candy-shop/issues)

</div>
