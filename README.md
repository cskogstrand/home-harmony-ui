# Home Harmony UI

Frontend application for the Home Harmony project.

## Tech stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Vitest + Testing Library

## Requirements

- Node.js 18+ (recommended: Node.js 20)
- npm (or Bun)

## Run locally

1. Clone the repository.
2. Install dependencies.
3. Start the development server.

```bash
# npm
npm install
npm run dev
```

The app will be available at the local URL printed by Vite (typically `http://localhost:5173`).

## Available scripts

```bash
npm run dev         # Start local dev server
npm run build       # Production build
npm run build:dev   # Development-mode build
npm run preview     # Preview production build locally
npm run lint        # Run ESLint
npm run test        # Run tests once
npm run test:watch  # Run tests in watch mode
```

## Bun (optional)

This repo also includes a Bun lockfile. If you prefer Bun:

```bash
bun install
bun run dev
```

## Deployment

This project is framework-agnostic and can be deployed to any static hosting provider that supports Vite build output.

Standard build output directory: `dist/`.
