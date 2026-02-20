import { PGlite } from '@electric-sql/pglite';

const db = new PGlite('idb://nexus');

export async function initDB() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS cards (
      id               SERIAL PRIMARY KEY,
      deck_id          INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      card_type        TEXT NOT NULL DEFAULT 'basic',
      front            TEXT NOT NULL,
      back             TEXT NOT NULL,
      front_image      TEXT DEFAULT NULL,
      back_image       TEXT DEFAULT NULL,
      image_size       INTEGER NOT NULL DEFAULT 100,
      extra            TEXT DEFAULT NULL,
      extra_image      TEXT DEFAULT NULL,
      confidence_score INTEGER NOT NULL DEFAULT 0 CHECK(confidence_score BETWEEN 0 AND 5),
      last_seen_at     BIGINT NOT NULL DEFAULT 0
    );
  `);

  // Migrations
  await db.exec(`
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'basic';
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS front_image TEXT DEFAULT NULL;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS back_image TEXT DEFAULT NULL;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_size INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS extra TEXT DEFAULT NULL;
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS extra_image TEXT DEFAULT NULL;
  `);
}

export async function getDecks() {
  const result = await db.query(`SELECT * FROM decks ORDER BY created_at DESC`);
  return result.rows;
}

export async function createDeck(name: string) {
  await db.query(`INSERT INTO decks (name) VALUES ($1)`, [name]);
}

export async function getCardsForDeck(deckId: number) {
  const result = await db.query(
    `SELECT * FROM cards WHERE deck_id = $1`,
    [deckId]
  );
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
  extraImage: string | null = null
) {
  if (cardType === 'basic') {
    await db.query(
      `INSERT INTO cards (deck_id, card_type, front, back, front_image, back_image, extra, extra_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [deckId, cardType, front, back, frontImage, backImage, extra, extraImage]
    );
    return;
  }

  const matches = [...front.matchAll(/\{\{c(\d+)::(.+?)\}\}/g)];
  if (matches.length === 0) return;

  const groups = [...new Set(matches.map(m => m[1]))];

  for (const group of groups) {
    const cardFront = front.replace(/\{\{c(\d+)::(.+?)\}\}/g, (_, g, answer) => {
      return g === group ? `{{${answer}}}` : answer;
    });
    const answers = matches
      .filter(m => m[1] === group)
      .map(m => m[2])
      .join(', ');

    await db.query(
      `INSERT INTO cards (deck_id, card_type, front, back, front_image, back_image, extra, extra_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [deckId, 'cloze', cardFront, answers, frontImage, backImage, extra, extraImage]
    );
  }
}

export async function updateConfidence(cardId: number, score: number) {
  await db.query(
    `UPDATE cards SET confidence_score = $1, last_seen_at = EXTRACT(EPOCH FROM NOW()) WHERE id = $2`,
    [score, cardId]
  );
}

export async function deleteCard(cardId: number) {
  await db.query(`DELETE FROM cards WHERE id = $1`, [cardId]);
}

export async function updateCard(
  cardId: number,
  front: string,
  back: string,
  frontImage: string | null = null,
  backImage: string | null = null,
  imageSize: number = 100,
  extra: string | null = null,
  extraImage: string | null = null
) {
  await db.query(
    `UPDATE cards SET front = $1, back = $2, front_image = $3, back_image = $4,
     image_size = $5, extra = $6, extra_image = $7 WHERE id = $8`,
    [front, back, frontImage, backImage, imageSize, extra, extraImage, cardId]
  );
}

export default db;