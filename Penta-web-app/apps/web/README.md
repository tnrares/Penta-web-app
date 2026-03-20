# Penta web (Nuxt)

## Local development

1. Start the API (`apps/server`) so it listens on **port 3000** (default `PORT`, or set in server env).
2. Copy `.env.example` to `.env` and set `NUXT_PUBLIC_SERVER_URL` if the API is not at `http://localhost:3000`.
3. Run this app: `bun run dev` — Nuxt serves the UI on **port 3001** (`devServer.port`).

If you see `ERR_CONNECTION_REFUSED` in the browser, the API is not running or `NUXT_PUBLIC_SERVER_URL` points at the wrong host/port.

## Bundle analysis

```bash
bun run analyze
```

Opens a Rollup stats report after build (see `nuxt.config.ts`).
