# Murlan

Murlan is a real-time multiplayer web game for private rooms. Players can create a room, share an invite link, join from the browser, and play with server-authoritative rules.

The client only sends player intentions. A Cloudflare Durable Object owns the room state, validates every action, updates the game, and broadcasts changes over WebSocket.

## Features

- Private room creation with invite links
- Anonymous local sessions per browser
- Real-time updates through WebSocket
- Server-side validation for joins, ready state, game start, plays, passes, and leaving
- Support for 2 to 5 players per room
- Durable Object storage for authoritative room state
- Static SvelteKit frontend served by the Worker assets pipeline

## Tech Stack

- TypeScript
- SvelteKit
- Vite
- Cloudflare Workers
- Cloudflare Durable Objects
- Wrangler

## Project Structure

```txt
src/lib/game/          Core card, deck, rule, scoring, and game state logic
src/lib/cloudflare/    Browser-side API, session, and realtime helpers
src/lib/components/    Svelte UI components
src/routes/            SvelteKit pages
src/worker/            Cloudflare Worker and Durable Object backend
wrangler.jsonc         Cloudflare Worker configuration
```

## Requirements

- Node.js
- npm
- A Cloudflare account for deployment
- Wrangler authentication for deployment with `npx wrangler login`

## Local Setup

Install dependencies:

```sh
npm install
```

Optional: create local Worker variables from the example file:

```sh
cp .dev.vars.example .dev.vars
```

Start the full local app through Wrangler:

```sh
npm run dev
```

The app is served by Wrangler, with the Worker handling `/api/*` routes and the built frontend served as static assets.

## Scripts

```sh
npm run dev
```

Builds the frontend and starts `wrangler dev`.

```sh
npm run dev:frontend
```

Starts the Vite frontend dev server.

```sh
npm run dev:worker
```

Starts the Worker with Wrangler.

```sh
npm run build
```

Builds the SvelteKit frontend.

```sh
npm run check
```

Runs Svelte and TypeScript checks for both frontend and Worker code.

```sh
npm run deploy
```

Builds the frontend and deploys the Worker to Cloudflare.

## Cloudflare Configuration

The Worker is configured in `wrangler.jsonc`.

- Worker name: `murlan`
- Worker entrypoint: `src/worker/index.ts`
- Static assets directory: `build`
- Worker-first routing: `/api/*`
- Durable Object binding: `ROOMS`
- Durable Object class: `RoomDurableObject`

Local Durable Object state is stored by Wrangler under `.wrangler/`, which is ignored by Git.

## Environment Variables

The current app does not require secrets for local development.

`PUBLIC_SITE_URL` can be set for local Worker-generated URLs:

```txt
PUBLIC_SITE_URL=http://localhost:8787
```

Do not commit real `.env` or `.dev.vars` files. The repository only tracks `.dev.vars.example`.

## Deployment

Authenticate Wrangler if needed:

```sh
npx wrangler login
```

Deploy:

```sh
npm run deploy
```

Wrangler will build the Worker, upload the static assets from `build`, and apply the Durable Object configuration from `wrangler.jsonc`.

## Notes

- `node_modules/`, `build/`, `.svelte-kit/`, `.wrangler/`, `.env`, `.dev.vars`, and `.DS_Store` are ignored.
- Room invite tokens and player session secrets are generated at runtime and are not stored in the repository.
- The package is marked as `private` because this project is an application, not an npm library.
