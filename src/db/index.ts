import { PGlite } from '@electric-sql/pglite';
import type { CardWithNote } from '../types';

// ─── Note on the DB choice ────────────────────────────────────────────────────
// We're using PGlite (Postgres-in-WASM) for browser-local persistence.
// This works well but carries more weight than a pure SQLite solution would.
//
// If you later want to migrate to something lighter:
//   • Browser:  @sqlite.org/sqlite-wasm  (official WASM build, origin-private FS)
//   • Desktop:  better-sqlite3 via Tauri/Electron
//
// To keep the DB layer portable, we deliberately avoid Postgres-specific syntax
// wherever possible. In particular:
//   ✗  EXTRACT(EPOCH FROM NOW())  — Postgres only
//   ✓  Pass Date.now() as a $n parameter from JS  — portable everywhere
// ─────────────────────────────────────────────────────────────────────────────

const db = new PGlite('idb://nexus');

export async function initDB() {
  // ── Core schema ─────────────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at BIGINT NOT NULL DEFAULT 0
    );

    -- notes: the source of truth for card *content*.
    -- One note can produce multiple cards (e.g. cloze with several blanks).
    CREATE TABLE IF NOT EXISTS notes (
      id          SERIAL PRIMARY KEY,
      deck_id     INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      card_type   TEXT NOT NULL DEFAULT 'basic',
      front       TEXT NOT NULL DEFAULT '',
      back        TEXT NOT NULL DEFAULT '',
      front_image TEXT DEFAULT NULL,
      back_image  TEXT DEFAULT NULL,
      image_size  INTEGER NOT NULL DEFAULT 100,
      extra       TEXT DEFAULT NULL,
      extra_image TEXT DEFAULT NULL,
      created_at  BIGINT NOT NULL DEFAULT 0
    );

    -- cards: the testable unit. Stores ONLY scheduling state.
    -- All content lives in notes. Join on note_id to render a card.
    CREATE TABLE IF NOT EXISTS cards (
      id               SERIAL PRIMARY KEY,
      note_id          INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      confidence_score INTEGER NOT NULL DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 5),
      last_seen_at     BIGINT NOT NULL DEFAULT 0
    );
  `);

  // ── Live migration: legacy flat-card schema → Note/Card separation ──────────
  // Detects whether the old 'front' column still exists on cards.
  // If so, backfills the notes table and strips content columns from cards.
  const legacyCheck = await db.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'cards' AND column_name = 'front'
  `);

  if (legacyCheck.rows.length > 0) {
    // Add note_id to old cards table (nullable during migration)
    await db.exec(`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS note_id_new INTEGER;
    `);

    // For every legacy card, create a matching note and link it back
    const legacyCards = await db.query<{
      id: number; deck_id: number; card_type: string;
      front: string; back: string;
      front_image: string | null; back_image: string | null;
      image_size: number; extra: string | null; extra_image: string | null;
      created_at: number;
    }>(`SELECT * FROM cards WHERE note_id_new IS NULL`);

    for (const card of legacyCards.rows) {
      const noteResult = await db.query<{ id: number }>(`
        INSERT INTO notes
          (deck_id, card_type, front, back, front_image, back_image, image_size, extra, extra_image, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [
        card.deck_id, card.card_type ?? 'basic',
        card.front ?? '', card.back ?? '',
        card.front_image ?? null, card.back_image ?? null,
        card.image_size ?? 100,
        card.extra ?? null, card.extra_image ?? null,
        card.created_at ?? 0,
      ]);
      await db.query(
        `UPDATE cards SET note_id_new = $1 WHERE id = $2`,
        [noteResult.rows[0].id, card.id]
      );
    }

    // Swap columns and drop the old content columns from cards
    await db.exec(`
      ALTER TABLE cards DROP COLUMN IF EXISTS note_id;
      ALTER TABLE cards RENAME COLUMN note_id_new TO note_id;
      ALTER TABLE cards DROP COLUMN IF EXISTS deck_id;
      ALTER TABLE cards DROP COLUMN IF EXISTS card_type;
      ALTER TABLE cards DROP COLUMN IF EXISTS front;
      ALTER TABLE cards DROP COLUMN IF EXISTS back;
      ALTER TABLE cards DROP COLUMN IF EXISTS front_image;
      ALTER TABLE cards DROP COLUMN IF EXISTS back_image;
      ALTER TABLE cards DROP COLUMN IF EXISTS image_size;
      ALTER TABLE cards DROP COLUMN IF EXISTS extra;
      ALTER TABLE cards DROP COLUMN IF EXISTS extra_image;
      ALTER TABLE cards DROP COLUMN IF EXISTS created_at;
    `);
  }
}

// ─── Deck operations ──────────────────────────────────────────────────────────

export async function getDecks() {
  const result = await db.query(`SELECT * FROM decks ORDER BY created_at DESC`);
  return result.rows;
}

export async function createDeck(name: string) {
  await db.query(
    `INSERT INTO decks (name, created_at) VALUES ($1, $2)`,
    [name, Date.now()]
  );
}

// ─── Card/Note queries ────────────────────────────────────────────────────────

// Returns a flat CardWithNote join — the UI only ever needs this shape.
export async function getCardsForDeck(deckId: number): Promise<CardWithNote[]> {
  const result = await db.query<CardWithNote>(`
    SELECT
      cards.id,
      cards.note_id,
      cards.confidence_score,
      cards.last_seen_at,
      notes.card_type,
      notes.front,
      notes.back,
      notes.front_image,
      notes.back_image,
      notes.image_size,
      notes.extra,
      notes.extra_image
    FROM cards
    JOIN notes ON cards.note_id = notes.id
    WHERE notes.deck_id = $1
    ORDER BY notes.created_at ASC
  `, [deckId]);
  return result.rows;
}

export async function addCard(
  deckId: number,
  front: string,
  back: string,
  cardType: 'basic' | 'cloze' = 'basic',
  frontImage: string | null = null,
  backImage: string | null = null,
  extra: string | null = null,
  extraImage: string | null = null,
) {
  const now = Date.now();

  if (cardType === 'basic') {
    // 1 note → 1 card
    const noteResult = await db.query<{ id: number }>(`
      INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, extra, extra_image, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, [deckId, 'basic', front, back, frontImage, backImage, extra, extraImage, now]);

    await db.query(
      `INSERT INTO cards (note_id, confidence_score, last_seen_at) VALUES ($1, 0, 0)`,
      [noteResult.rows[0].id]
    );
    return;
  }

  // Cloze: 1 note → N cards (one per blank group)
  const matches = [...front.matchAll(/\{\{c(\d+)::(.+?)\}\}/g)];
  if (matches.length === 0) return;

  const noteResult = await db.query<{ id: number }>(`
    INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, extra, extra_image, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id
  `, [deckId, 'cloze', front, '', frontImage, backImage, extra, extraImage, now]);

  const noteId = noteResult.rows[0].id;
  const groups = [...new Set(matches.map(m => m[1]))];

  for (const group of groups) {
    const cardFront = front.replace(/\{\{c(\d+)::(.+?)\}\}/g, (_, g, answer) =>
      g === group ? `{{${answer}}}` : answer
    );
    const answers = matches
      .filter(m => m[1] === group)
      .map(m => m[2])
      .join(', ');

    // Each cloze card gets its own rendered front/answer stored in a child note
    // that points back to the same deck, sharing the parent note's media.
    // For simplicity we store each cloze card's render inline as its own note row.
    const childNoteResult = await db.query<{ id: number }>(`
      INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, extra, extra_image, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `, [deckId, 'cloze', cardFront, answers, frontImage, backImage, extra, extraImage, now]);

    await db.query(
      `INSERT INTO cards (note_id, confidence_score, last_seen_at) VALUES ($1, 0, 0)`,
      [childNoteResult.rows[0].id]
    );
  }

  // The parent note (template) is not itself a testable card; delete it.
  await db.query(`DELETE FROM notes WHERE id = $1`, [noteId]);
}

// Updates scheduling state only — content is immutable from here.
export async function updateConfidence(cardId: number, score: number) {
  await db.query(
    `UPDATE cards SET confidence_score = $1, last_seen_at = $2 WHERE id = $3`,
    [score, Date.now(), cardId]
  );
}

export async function deleteCard(cardId: number) {
  // Deleting the card also deletes its note via ON DELETE CASCADE on the note's cards.
  // But since note → card is 1:many, we need to delete the note to cascade properly.
  // Get the note_id first, then delete the note (which cascades to all its cards).
  const result = await db.query<{ note_id: number }>(
    `SELECT note_id FROM cards WHERE id = $1`, [cardId]
  );
  if (result.rows.length > 0) {
    await db.query(`DELETE FROM notes WHERE id = $1`, [result.rows[0].note_id]);
  }
}

// Updates note content only — scheduling state is never touched here.
export async function updateCard(
  cardId: number,
  front: string,
  back: string,
  frontImage: string | null = null,
  backImage: string | null = null,
  imageSize: number = 100,
  extra: string | null = null,
  extraImage: string | null = null,
) {
  await db.query(`
    UPDATE notes SET
      front = $1, back = $2,
      front_image = $3, back_image = $4,
      image_size = $5,
      extra = $6, extra_image = $7
    WHERE id = (SELECT note_id FROM cards WHERE id = $8)
  `, [front, back, frontImage, backImage, imageSize, extra, extraImage, cardId]);
}

export default db;