# CLAUDE.md — Nexus

Nexus is a client-side flashcard / spaced-repetition app built with React 19, TypeScript, and Vite. All data is stored locally in the browser via PGlite (PostgreSQL compiled to WASM), backed by IndexedDB. There is no server, no API, and no auth layer.

---

## Development commands

```bash
npm run dev       # start Vite dev server (http://localhost:5173)
npm run build     # tsc -b then vite build → dist/
npm run lint      # ESLint (flat config, TS + React rules)
npm run preview   # serve the production build locally
```

There is no test runner configured. If you add tests, Vitest is the natural choice given the Vite toolchain.

---

## Repository layout

```
nexus/
├── index.html              # HTML entry point (loads src/main.tsx via <script type="module">)
├── vite.config.ts          # Vite config — React plugin + Tailwind CSS plugin
├── eslint.config.js        # ESLint flat config
├── tsconfig.json           # Root TS config (references app + node configs)
├── tsconfig.app.json       # App config: ES2022, strict, bundler resolution
├── tsconfig.node.json      # Node/build-tool config (vite.config.ts)
└── src/
    ├── main.tsx            # React root (renders <App /> into #root)
    ├── App.tsx             # Top-level component; owns all global state and routing
    ├── index.css           # Tailwind import + custom card-content styles
    ├── assets/             # Static assets (imported directly in TS)
    ├── types/
    │   └── index.ts        # All shared TypeScript interfaces and type aliases
    ├── db/
    │   └── index.ts        # PGlite setup, schema init, migrations, all DB functions
    ├── lib/
    │   └── session.ts      # buildSession() — the CBR spaced-repetition algorithm
    └── components/
        ├── DeckView.tsx    # Deck management: card list, add/edit/delete cards
        ├── Reviewer.tsx    # Study session UI: flip cards, score confidence
        ├── SessionSummary.tsx  # Post-session stats
        ├── CardEditor.tsx  # TipTap rich-text editor for card content
        ├── ImageUploader.tsx   # Image attachment handling (base64 data URLs)
        ├── HtmlRenderer.tsx    # Safely renders stored HTML card content
        └── ConfirmDialog.tsx   # Reusable confirmation modal
```

---

## Architecture

### State management and routing

There is no router library. Navigation is a discriminated union stored in `App.tsx`:

```ts
type AppView =
  | { kind: 'home' }
  | { kind: 'deck'; deck: Deck }
  | { kind: 'session'; deckIds: number[]; deckLabel: string; intensity: number }
  | { kind: 'summary'; deckLabel: string; results: SessionResult[]; deckIds: number[]; intensity: number }
```

All global state lives in `App.tsx` and is passed down as props. There is no context, no Redux, no Zustand. Keep it that way unless complexity clearly demands otherwise.

### Database layer (`src/db/index.ts`)

The single PGlite instance is created at module scope:

```ts
const db = new PGlite('idb://nexus');
```

`initDB()` must be called once at startup before any other DB function. It creates tables with `CREATE TABLE IF NOT EXISTS` and runs live migrations idempotently.

**Key design rules:**

- Always pass `Date.now()` from JS for timestamps. Never use `EXTRACT(EPOCH FROM NOW())` or other Postgres-specific time functions — the codebase targets portability to SQLite/WASM.
- All timestamps are stored as `BIGINT` (milliseconds since epoch).
- Always use parameterized queries (`$1`, `$2`, …). Never interpolate user data into SQL strings.
- PGlite does not support array binding in `IN` clauses; use dynamic placeholder generation (`$1,$2,$3,...`).

**Schema overview:**

| Table | Purpose |
|---|---|
| `deck_groups` | Optional folders that group decks |
| `decks` | Study decks; `group_id` is nullable (ungrouped) |
| `notes` | Source of truth for card *content* (front/back/images) |
| `cards` | Scheduling state only (`confidence_score`, `last_seen_at`) |

The Note → Card relationship is 1:many. A basic card produces one note and one card. A cloze card with N blank groups produces N child notes (one rendered front per blank) and N cards; the parent template note is deleted after expansion.

`ON DELETE CASCADE`: deleting a deck removes its notes and all their cards automatically.
`ON DELETE SET NULL`: deleting a group ungroups its decks automatically.

**Exported DB functions:**

- `initDB()` — schema creation + migrations
- `getGroups()` / `createGroup()` / `renameGroup()` / `deleteGroup()`
- `moveDeckToGroup(deckId, groupId | null)`
- `getDecks()` / `createDeck()` / `deleteDeck()`
- `getCardsForDeck(deckId)` — single-deck JOIN query returning `CardWithNote[]`
- `getCardsForDecks(deckIds)` — multi-deck variant
- `addCard(deckId, front, back, cardType, ...)` — creates note + card(s)
- `updateCard(cardId, front, back, ...)` — updates note content only
- `updateConfidence(cardId, score)` — updates scheduling state only
- `deleteCard(cardId)` — deletes the parent note (cascades to cards)
- `getDeckStats()` — aggregate totals and mastery % per deck

### Spaced repetition (`src/lib/session.ts`)

`buildSession(cards, intensity)` implements Confidence-Based Review (CBR):

- **60%** of session slots filled from cards with `confidence_score` 0–2 (low)
- **30%** from scores 3–4 (medium)
- **10%** from score 5 (mastered)

Within each tier, cards are shuffled (Fisher-Yates) then stable-sorted by `last_seen_at` ascending so the oldest-seen cards surface first. The shuffle prevents insertion-order bias in new decks where all timestamps are 0.

### Card types

**Basic:** `front` / `back` HTML strings. One note → one card.

**Cloze:** Uses `{{c1::answer}}` syntax in the `front` field. Multiple blank groups (`c1`, `c2`, …) each produce a separate card. Each card's rendered front replaces the target blank with `{{answer}}` and shows other blanks as plain text.

---

## TypeScript conventions

- All shared types live in `src/types/index.ts`. Add new types there.
- The UI always works with `CardWithNote` (the flat JOIN result), never with raw `Note` or `Card` separately.
- `ConfidenceScore` is `0 | 1 | 2 | 3 | 4 | 5` — a union, not a plain `number`.
- `intensity` is a plain `number` (5–100), not a union type.
- TypeScript strict mode is on. `noUnusedLocals` and `noUnusedParameters` are both enabled — fix, don't suppress.
- Target: ES2022. Module resolution: `bundler` (Vite handles imports).

---

## Styling conventions

- Tailwind CSS 4.x (imported via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed).
- Use Tailwind utility classes for all layout and spacing.
- Custom styles for rendered card HTML are scoped under `.card-content` in `src/index.css`. This class is applied by `HtmlRenderer.tsx`. Don't add global resets there.
- Fonts: **DM Sans** (body) and **DM Mono** (code), loaded via `@import` in `index.css`.
- Dark theme — the app uses a `slate`/`sky` palette. Keep new UI consistent with this.

---

## Component conventions

- All components are function components with explicit TypeScript prop interfaces.
- No class components.
- `useEffect` cleanup is always returned when adding event listeners (see `App.tsx` for the pattern).
- `useRef` is used for input focus management; avoid `document.querySelector`.
- Images are stored as base64 data URLs in the `front_image` / `back_image` / `extra_image` columns. `ImageUploader.tsx` handles the conversion. Maximum image size is controlled by the `image_size` field (percentage, default 100).
- Rich text content is created via TipTap and stored as HTML strings. Always render card HTML through `HtmlRenderer.tsx`, not via `dangerouslySetInnerHTML` directly in other components.

---

## Key constraints and gotchas

- **PGlite must be excluded from Vite's dep optimizer.** `vite.config.ts` already does this with `optimizeDeps: { exclude: ['@electric-sql/pglite'] }`. Do not remove this.
- **No array binding in PGlite.** For `IN (...)` clauses with dynamic values, generate `$1, $2, $3, ...` placeholders manually (see `getCardsForDecks`).
- **All DB mutations go through `src/db/index.ts`.** Do not import `db` directly from components; use the exported async functions.
- **Content and scheduling are separated.** `updateCard()` only touches the `notes` table. `updateConfidence()` only touches the `cards` table. Keep them separate.
- **Deleting a card deletes via the note.** Because notes cascade to cards, `deleteCard()` deletes the note row, not the card row directly.
- **There are no tests.** Be careful when refactoring DB or session logic; manually verify in the browser.
- **No backend.** Do not introduce server-side dependencies or fetch calls to external APIs without an explicit product decision.
