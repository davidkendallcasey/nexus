export type ConfidenceScore = 0 | 1 | 2 | 3 | 4 | 5;

export type CardType = 'basic' | 'cloze';

export interface DeckGroup {
  id: number;
  name: string;
  created_at: number;
}

export interface Deck {
  id: number;
  name: string;
  group_id: number | null;
  created_at: number;
}

// ─── Raw DB entities ──────────────────────────────────────────────────────────
// Note: the source of truth for card *content*.
// One Note can produce many Cards (e.g. a cloze template with multiple blanks).
export interface Note {
  id: number;
  deck_id: number;
  card_type: CardType;
  front: string;
  back: string;
  front_image: string | null;
  back_image: string | null;
  image_size: number;
  extra: string | null;
  extra_image: string | null;
  created_at: number;
}

// Card: the testable unit. Stores *only* scheduling state.
// Content is always fetched via JOIN with notes.
export interface Card {
  id: number;
  note_id: number;
  confidence_score: ConfidenceScore;
  last_seen_at: number;
}

// ─── Joined type used throughout the UI ──────────────────────────────────────
// Returned by getCardsForDeck() — a flat join of Card + Note fields.
// The UI never needs to think about the two-table split; it just uses this.
export interface CardWithNote extends Card {
  card_type: CardType;
  front: string;
  back: string;
  front_image: string | null;
  back_image: string | null;
  image_size: number;
  extra: string | null;
  extra_image: string | null;
}

// ─── Session types ────────────────────────────────────────────────────────────
// intensity is now a plain number (5–100) — no more rigid union type.
export interface StudySession {
  deckIds: number[];   // one or many — multi-deck sessions supported
  intensity: number;
  queue: CardWithNote[];
  currentIndex: number;
}

// One entry per card graded during a session.
export interface SessionResult {
  cardId: number;
  score: ConfidenceScore;
}

// Aggregate stats returned for each deck on the home screen.
export interface DeckStats {
  deckId: number;
  totalCards: number;
  masteredCards: number;  // confidence_score = 5
  masteryPercent: number; // 0–100
}