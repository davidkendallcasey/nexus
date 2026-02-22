import Database from '@tauri-apps/plugin-sql';
import type { CardWithNote, DeckGroup } from '../types';

// ─── Note on the DB choice ────────────────────────────────────────────────────
// Using @tauri-apps/plugin-sql with SQLite for native desktop persistence.
// The DB file lives in the OS app data directory (~/.local/share/nexus/nexus.db).
//
// SQLite differences from PGlite:
//   • Placeholders are ? instead of $1, $2, ...
//   • AUTOINCREMENT instead of SERIAL
//   • PRAGMA table_info() instead of information_schema.columns
//   • lastInsertId from execute() instead of RETURNING id
//   • Foreign keys must be enabled with PRAGMA foreign_keys = ON
// ─────────────────────────────────────────────────────────────────────────────

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load('sqlite:nexus.db');
  return _db;
}

export async function initDB() {
  const db = await getDb();

  await db.execute('PRAGMA foreign_keys = ON');

  // ── Core schema ─────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS deck_groups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS decks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      group_id   INTEGER DEFAULT NULL REFERENCES deck_groups(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id     INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      card_type   TEXT NOT NULL DEFAULT 'basic',
      front       TEXT NOT NULL DEFAULT '',
      back        TEXT NOT NULL DEFAULT '',
      front_image TEXT DEFAULT NULL,
      back_image  TEXT DEFAULT NULL,
      image_size  INTEGER NOT NULL DEFAULT 100,
      extra       TEXT DEFAULT NULL,
      extra_image TEXT DEFAULT NULL,
      created_at  INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id          INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      confidence_score INTEGER NOT NULL DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 5),
      last_seen_at     INTEGER NOT NULL DEFAULT 0
    )
  `);

  // ── Migration: add group_id to decks tables predating this feature ──────────
  // SQLite doesn't support IF NOT EXISTS on ALTER TABLE; catch the error instead.
  try {
    await db.execute(`ALTER TABLE decks ADD COLUMN group_id INTEGER DEFAULT NULL REFERENCES deck_groups(id) ON DELETE SET NULL`);
  } catch { /* column already exists */ }

  // ── Live migration: legacy flat-card schema → Note/Card separation ──────────
  // Detects whether the old 'front' column still exists on cards.
  const tableInfo = await db.select<{ name: string }[]>(`PRAGMA table_info(cards)`);
  const hasFrontColumn = tableInfo.some(col => col.name === 'front');

  if (hasFrontColumn) {
    await db.execute(`ALTER TABLE cards ADD COLUMN note_id_new INTEGER`);

    const legacyCards = await db.select<{
      id: number; deck_id: number; card_type: string;
      front: string; back: string;
      front_image: string | null; back_image: string | null;
      image_size: number; extra: string | null; extra_image: string | null;
      created_at: number;
    }[]>(`SELECT * FROM cards WHERE note_id_new IS NULL`);

    for (const card of legacyCards) {
      const noteResult = await db.execute(
        `INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, image_size, extra, extra_image, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          card.deck_id, card.card_type ?? 'basic',
          card.front ?? '', card.back ?? '',
          card.front_image ?? null, card.back_image ?? null,
          card.image_size ?? 100,
          card.extra ?? null, card.extra_image ?? null,
          card.created_at ?? 0,
        ]
      );
      await db.execute(`UPDATE cards SET note_id_new = ? WHERE id = ?`, [noteResult.lastInsertId, card.id]);
    }

    // Recreate the cards table without the legacy content columns.
    // (SQLite's ALTER TABLE DROP COLUMN support varies; recreating is safer.)
    await db.execute(`
      CREATE TABLE cards_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id          INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        confidence_score INTEGER NOT NULL DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 5),
        last_seen_at     INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.execute(`INSERT INTO cards_new SELECT id, note_id_new, confidence_score, last_seen_at FROM cards`);
    await db.execute(`DROP TABLE cards`);
    await db.execute(`ALTER TABLE cards_new RENAME TO cards`);
  }
}

// ─── Deck Group operations ────────────────────────────────────────────────────

export async function getGroups(): Promise<DeckGroup[]> {
  const db = await getDb();
  return db.select<DeckGroup[]>(`SELECT * FROM deck_groups ORDER BY created_at ASC`);
}

export async function createGroup(name: string): Promise<DeckGroup> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO deck_groups (name, created_at) VALUES (?, ?)`,
    [name, Date.now()]
  );
  return { id: result.lastInsertId as number, name, created_at: Date.now() };
}

export async function renameGroup(id: number, name: string) {
  const db = await getDb();
  await db.execute(`UPDATE deck_groups SET name = ? WHERE id = ?`, [name, id]);
}

export async function deleteGroup(id: number) {
  const db = await getDb();
  await db.execute(`DELETE FROM deck_groups WHERE id = ?`, [id]);
}

export async function moveDeckToGroup(deckId: number, groupId: number | null) {
  const db = await getDb();
  await db.execute(`UPDATE decks SET group_id = ? WHERE id = ?`, [groupId, deckId]);
}

// ─── Deck operations ──────────────────────────────────────────────────────────

export async function getDecks() {
  const db = await getDb();
  return db.select<{ id: number; name: string; group_id: number | null; created_at: number }[]>(
    `SELECT * FROM decks ORDER BY created_at ASC`
  );
}

export async function createDeck(name: string) {
  const db = await getDb();
  await db.execute(`INSERT INTO decks (name, created_at) VALUES (?, ?)`, [name, Date.now()]);
}

export async function renameDeck(id: number, name: string) {
  const db = await getDb();
  await db.execute(`UPDATE decks SET name = ? WHERE id = ?`, [name, id]);
}

export async function deleteDeck(id: number) {
  const db = await getDb();
  await db.execute(`DELETE FROM decks WHERE id = ?`, [id]);
}

// ─── Card/Note queries ────────────────────────────────────────────────────────

export async function getCardsForDeck(deckId: number): Promise<CardWithNote[]> {
  const db = await getDb();
  return db.select<CardWithNote[]>(`
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
    WHERE notes.deck_id = ?
    ORDER BY notes.created_at ASC
  `, [deckId]);
}

export async function getCardsForDecks(deckIds: number[]): Promise<CardWithNote[]> {
  if (deckIds.length === 0) return [];
  const db = await getDb();
  const placeholders = deckIds.map(() => '?').join(', ');
  return db.select<CardWithNote[]>(`
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
    WHERE notes.deck_id IN (${placeholders})
    ORDER BY notes.created_at ASC
  `, deckIds);
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
  const db = await getDb();
  const now = Date.now();

  if (cardType === 'basic') {
    const noteResult = await db.execute(
      `INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, extra, extra_image, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [deckId, 'basic', front, back, frontImage, backImage, extra, extraImage, now]
    );
    await db.execute(
      `INSERT INTO cards (note_id, confidence_score, last_seen_at) VALUES (?, 0, 0)`,
      [noteResult.lastInsertId]
    );
    return;
  }

  // Cloze: 1 note → N cards (one per blank group)
  const matches = [...front.matchAll(/\{\{c(\d+)::(.+?)\}\}/g)];
  if (matches.length === 0) return;

  const parentResult = await db.execute(
    `INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, extra, extra_image, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [deckId, 'cloze', front, '', frontImage, backImage, extra, extraImage, now]
  );
  const parentNoteId = parentResult.lastInsertId as number;
  const groups = [...new Set(matches.map(m => m[1]))];

  for (const group of groups) {
    const cardFront = front.replace(/\{\{c(\d+)::(.+?)\}\}/g, (_, g, answer) =>
      g === group ? `{{${answer}}}` : answer
    );
    const answers = matches
      .filter(m => m[1] === group)
      .map(m => m[2])
      .join(', ');

    const childResult = await db.execute(
      `INSERT INTO notes (deck_id, card_type, front, back, front_image, back_image, extra, extra_image, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [deckId, 'cloze', cardFront, answers, frontImage, backImage, extra, extraImage, now]
    );
    await db.execute(
      `INSERT INTO cards (note_id, confidence_score, last_seen_at) VALUES (?, 0, 0)`,
      [childResult.lastInsertId]
    );
  }

  // The parent note (template) is not testable; delete it.
  await db.execute(`DELETE FROM notes WHERE id = ?`, [parentNoteId]);
}

export async function updateConfidence(cardId: number, score: number) {
  const db = await getDb();
  await db.execute(
    `UPDATE cards SET confidence_score = ?, last_seen_at = ? WHERE id = ?`,
    [score, Date.now(), cardId]
  );
}

export async function deleteCard(cardId: number) {
  const db = await getDb();
  const rows = await db.select<{ note_id: number }[]>(
    `SELECT note_id FROM cards WHERE id = ?`, [cardId]
  );
  if (rows.length > 0) {
    await db.execute(`DELETE FROM notes WHERE id = ?`, [rows[0].note_id]);
  }
}

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
  const db = await getDb();
  await db.execute(`
    UPDATE notes SET
      front = ?, back = ?,
      front_image = ?, back_image = ?,
      image_size = ?,
      extra = ?, extra_image = ?
    WHERE id = (SELECT note_id FROM cards WHERE id = ?)
  `, [front, back, frontImage, backImage, imageSize, extra, extraImage, cardId]);
}

export async function getDeckStats(): Promise<Record<number, { totalCards: number; masteredCards: number; masteryPercent: number }>> {
  const db = await getDb();
  const rows = await db.select<{ deck_id: number; total_cards: number; mastered_cards: number }[]>(`
    SELECT
      notes.deck_id,
      COUNT(cards.id)                                                        AS total_cards,
      COUNT(CASE WHEN cards.confidence_score = 5 THEN 1 END)                AS mastered_cards
    FROM notes
    JOIN cards ON cards.note_id = notes.id
    GROUP BY notes.deck_id
  `);

  const stats: Record<number, { totalCards: number; masteredCards: number; masteryPercent: number }> = {};
  for (const row of rows) {
    const total = row.total_cards;
    const mastered = row.mastered_cards;
    stats[row.deck_id] = {
      totalCards: total,
      masteredCards: mastered,
      masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
    };
  }
  return stats;
}
