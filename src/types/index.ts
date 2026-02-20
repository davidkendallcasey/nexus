export type ConfidenceScore = 0 | 1 | 2 | 3 | 4 | 5;

export type CardType = 'basic' | 'cloze';

export interface Deck {
  id: number;
  name: string;
  created_at: number;
}

export interface Card {
  id: number;
  note_id: number;
  card_type: CardType;
  confidence_score: ConfidenceScore;
  last_seen_at: number;
  front: string;
  back: string;
  front_image: string | null;
  back_image: string | null;
  image_size: number;
  extra: string | null;
  extra_image: string | null;
}

export type SessionIntensity = 10 | 20 | 50;

export interface StudySession {
  deckId: number;
  intensity: SessionIntensity;
  queue: Card[];
  currentIndex: number;
}