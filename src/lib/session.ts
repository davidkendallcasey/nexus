import type { CardWithNote } from '../types';

// ─── Fisher-Yates shuffle (in-place) ─────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── buildSession ─────────────────────────────────────────────────────────────
// Constructs an ephemeral session queue in memory using the 60/30/10 CBR split.
//
// Sort strategy within each tier:
//   1. Shuffle the tier first (randomises cards with equal last_seen_at, which
//      is every card in a brand-new deck where all timestamps are 0 — fixes the
//      "always same insertion-order" dead state).
//   2. Then stable-sort by last_seen_at ascending.
//
// Result: cards seen longest ago surface first; cards never seen (last_seen_at = 0)
// appear in random order rather than always insertion order.
//
export function buildSession(cards: CardWithNote[], intensity: number): CardWithNote[] {
  const sortByOldest = (arr: CardWithNote[]) =>
    shuffle([...arr]).sort((a, b) => a.last_seen_at - b.last_seen_at);

  const low     = sortByOldest(cards.filter(c => c.confidence_score <= 2));
  const medium  = sortByOldest(cards.filter(c => c.confidence_score === 3 || c.confidence_score === 4));
  const mastered = sortByOldest(cards.filter(c => c.confidence_score === 5));

  const nLow      = Math.round(intensity * 0.60);
  const nMedium   = Math.round(intensity * 0.30);
  const nMastered = Math.round(intensity * 0.10);

  return [
    ...low.slice(0, nLow),
    ...medium.slice(0, nMedium),
    ...mastered.slice(0, nMastered),
  ].slice(0, intensity);
}