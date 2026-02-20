import type { Card, SessionIntensity } from '../types';

export function buildSession(cards: Card[], intensity: SessionIntensity): Card[] {
  const low = cards
    .filter(c => c.confidence_score <= 2)
    .sort((a, b) => a.last_seen_at - b.last_seen_at);

  const medium = cards
    .filter(c => c.confidence_score === 3 || c.confidence_score === 4)
    .sort((a, b) => a.last_seen_at - b.last_seen_at);

  const mastered = cards
    .filter(c => c.confidence_score === 5)
    .sort((a, b) => a.last_seen_at - b.last_seen_at);

  const nLow      = Math.round(intensity * 0.60);
  const nMedium   = Math.round(intensity * 0.30);
  const nMastered = Math.round(intensity * 0.10);

  return [
    ...low.slice(0, nLow),
    ...medium.slice(0, nMedium),
    ...mastered.slice(0, nMastered),
  ].slice(0, intensity);
}