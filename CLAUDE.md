# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start the Express server (port 3000 by default)
PORT=3001 npm run dev   # run on a different port if 3000 is busy
```

There are no tests or lint scripts.

## Architecture

Single-page app with a thin Express backend.

**`index.html`** — the entire frontend. No build step or bundler. All CSS, HTML, and JavaScript live inline in this one file. Key sections:
- Boot animation → matrix canvas background → terminal-styled invitation card
- Editable fields (`contenteditable` with `data-field` attributes) for name, degree, university, GPA, date, time, and venue — changes sync live to the info grid below
- Info grid (date / time / venue) with a "📍 Xem chi tiết" button that opens a location modal (`#loc-modal`) showing a campus map image (`campus-map.png`) and a Google Maps link
- RSVP modal (`#modal`) — submits to `POST /api/rsvp` and shows success state on completion
- Countdown timer reads from the `data-field="date"` and `data-field="time"` editables at runtime

**`server.js`** — Express server with two routes:
- `GET /` — serves `index.html` (only this file; does not serve `server.js`, `.env`, or `package.json`)
- `POST /api/rsvp` — validates and inserts into PostgreSQL `rsvps` table; returns 503 if `DATABASE_URL` is not set

**Database** — Neon (serverless PostgreSQL). Connection string goes in `.env` as `DATABASE_URL`. The `rsvps` table is auto-created on startup via `CREATE TABLE IF NOT EXISTS`. The pool is `null` when `DATABASE_URL` is absent, which gracefully disables the RSVP API without crashing.

**`campus-map.png`** — campus map image shown in the location detail modal. Must be placed manually in the project root; it is not committed to the repo.
