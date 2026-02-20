import { useState, useEffect, useCallback } from 'react';
import type { Card, StudySession, ConfidenceScore } from '../types';
import { updateConfidence } from '../db';

interface Props {
  session: StudySession;
  onSessionComplete: () => void;
  onExit: () => void;
}

const CONFIDENCE_BUTTONS: { score: ConfidenceScore; label: string; color: string }[] = [
  { score: 1, label: 'Clueless',  color: 'bg-red-600 hover:bg-red-500' },
  { score: 2, label: 'Barely',    color: 'bg-orange-500 hover:bg-orange-400' },
  { score: 3, label: 'Familiar',  color: 'bg-yellow-500 hover:bg-yellow-400' },
  { score: 4, label: 'Good',      color: 'bg-lime-500 hover:bg-lime-400' },
  { score: 5, label: 'Mastered',  color: 'bg-green-500 hover:bg-green-400' },
];

function renderClozeHidden(text: string): React.ReactNode {
  const parts = text.split(/\{\{(.+?)\}\}/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="inline-block bg-gray-600 text-gray-600 rounded px-3 mx-1 select-none">{part}</span>
      : <span key={i}>{part}</span>
  );
}

function renderClozeRevealed(text: string): React.ReactNode {
  const parts = text.split(/\{\{(.+?)\}\}/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="inline-block bg-green-700 text-green-200 rounded px-3 mx-1 font-bold">{part}</span>
      : <span key={i}>{part}</span>
  );
}

function CardImage({ src, size }: { src: string; size: number }) {
  return (
    <img
      src={src}
      alt=""
      className="rounded-xl object-contain mx-auto mt-4"
      style={{ width: `${size}%`, maxHeight: '60vh' }}
    />
  );
}

interface CardDisplayProps {
  card: Card;
  isFlipped: boolean;
}

function CardDisplay({ card, isFlipped }: CardDisplayProps) {
  const isCloze = card.card_type === 'cloze';
  const size = card.image_size ?? 100;

  if (!isFlipped) {
    return (
      <>
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-6">
          {isCloze ? 'Fill in the blank' : 'Front'}
        </p>
        <p className="text-2xl font-semibold leading-relaxed">
          {isCloze ? renderClozeHidden(card.front) : card.front}
        </p>
        {card.front_image && <CardImage src={card.front_image} size={size} />}
      </>
    );
  }

  const hasExtra = card.extra || card.extra_image;

  return (
    <>
      <p className="text-xs uppercase tracking-widest text-gray-500 mb-6">
        {isCloze ? 'Revealed' : 'Back'}
      </p>
      <p className="text-2xl font-semibold leading-relaxed">
        {isCloze ? renderClozeRevealed(card.front) : card.back}
      </p>
      {card.back_image
        ? <CardImage src={card.back_image} size={size} />
        : card.front_image
          ? <CardImage src={card.front_image} size={size} />
          : null
      }

      {/* Extra — only shown if it has content */}
      {hasExtra && (
        <div className="mt-6 pt-6 border-t border-gray-600 w-full text-left">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Extra</p>
          {card.extra && (
            <p className="text-gray-300 text-base leading-relaxed">{card.extra}</p>
          )}
          {card.extra_image && (
            <CardImage src={card.extra_image} size={size} />
          )}
        </div>
      )}
    </>
  );
}

export default function Reviewer({ session, onSessionComplete, onExit }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const queue = session.queue;
  const card: Card = queue[currentIndex];
  const progress = Math.round((currentIndex / queue.length) * 100);
  const isCloze = card.card_type === 'cloze';

  async function handleGrade(score: ConfidenceScore) {
    await updateConfidence(card.id, score);
    if (currentIndex + 1 >= queue.length) {
      onSessionComplete();
    } else {
      setCurrentIndex(i => i + 1);
      setIsFlipped(false);
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setIsFlipped(f => !f);
    }
    if (isFlipped) {
      if (e.key === '1') handleGrade(1);
      if (e.key === '2') handleGrade(2);
      if (e.key === '3') handleGrade(3);
      if (e.key === '4') handleGrade(4);
      if (e.key === '5') handleGrade(5);
    }
  }, [isFlipped, currentIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 pt-4">
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-white transition text-sm flex items-center gap-2"
        >
          ✕ End Session
        </button>
        <p className="text-gray-400 text-sm">{currentIndex + 1} / {queue.length}</p>
        {isCloze
          ? <span className="text-xs bg-purple-800 text-purple-200 px-2 py-0.5 rounded-full">cloze</span>
          : <span className="w-16" />
        }
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-800 h-2 mt-3">
        <div
          className="bg-blue-500 h-2 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto">
        <div
          onClick={() => setIsFlipped(f => !f)}
          className="bg-gray-800 rounded-2xl p-10 max-w-3xl w-full cursor-pointer hover:bg-gray-700 transition text-center"
        >
          <CardDisplay card={card} isFlipped={isFlipped} />
          <p className="text-gray-500 text-sm mt-8">
            {!isFlipped
              ? <>Click or press <kbd className="bg-gray-700 px-2 py-0.5 rounded text-xs">Space</kbd> to reveal</>
              : <>Press <kbd className="bg-gray-700 px-2 py-0.5 rounded text-xs">1</kbd>–<kbd className="bg-gray-700 px-2 py-0.5 rounded text-xs">5</kbd> to grade</>
            }
          </p>
        </div>
      </div>

      {/* Confidence Buttons */}
      {isFlipped && (
        <div className="flex gap-2 p-6 justify-center flex-wrap">
          {CONFIDENCE_BUTTONS.map(btn => (
            <button
              key={btn.score}
              onClick={() => handleGrade(btn.score)}
              className={`${btn.color} text-white font-bold px-4 py-3 rounded-xl transition flex flex-col items-center min-w-16`}
            >
              <span className="text-lg">{btn.score}</span>
              <span className="text-xs">{btn.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}