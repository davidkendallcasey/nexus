import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardWithNote, StudySession, ConfidenceScore, SessionResult } from '../types';
import { updateConfidence } from '../db';
import { HtmlRenderer, ClozeHtmlRenderer } from './HtmlRenderer';

interface Props {
  session: StudySession;
  onSessionComplete: (results: SessionResult[]) => void;
  onExit: () => void;
}

const CONFIDENCE_BUTTONS: { score: ConfidenceScore; label: string; color: string }[] = [
  { score: 1, label: 'Clueless',  color: 'bg-red-600 hover:bg-red-500' },
  { score: 2, label: 'Barely',    color: 'bg-orange-500 hover:bg-orange-400' },
  { score: 3, label: 'Familiar',  color: 'bg-yellow-500 hover:bg-yellow-400' },
  { score: 4, label: 'Good',      color: 'bg-lime-500 hover:bg-lime-400' },
  { score: 5, label: 'Mastered',  color: 'bg-green-500 hover:bg-green-400' },
];

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
  card: CardWithNote;
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

        {isCloze
          ? <ClozeHtmlRenderer
              html={card.front}
              revealed={false}
              className="text-2xl font-semibold"
            />
          : <HtmlRenderer
              html={card.front}
              className="text-2xl font-semibold"
            />
        }

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

      {isCloze
        ? <ClozeHtmlRenderer
            html={card.front}
            revealed={true}
            className="text-2xl font-semibold"
          />
        : <HtmlRenderer
            html={card.back}
            className="text-2xl font-semibold"
          />
      }

      {card.back_image
        ? <CardImage src={card.back_image} size={size} />
        : card.front_image
          ? <CardImage src={card.front_image} size={size} />
          : null
      }

      {hasExtra && (
        <div className="mt-6 pt-6 border-t border-gray-600 w-full text-left">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Extra</p>
          {card.extra && (
            <HtmlRenderer
              html={card.extra}
              className="text-gray-300 text-base"
            />
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

  // Accumulate grades in a ref (not state) so handleGrade always sees
  // the latest value without needing it in the useCallback dependency array.
  const resultsRef = useRef<SessionResult[]>([]);

  const queue = session.queue;
  const card: CardWithNote = queue[currentIndex];
  const progress = Math.round((currentIndex / queue.length) * 100);
  const isCloze = card.card_type === 'cloze';

  async function handleGrade(score: ConfidenceScore) {
    await updateConfidence(card.id, score);
    resultsRef.current = [...resultsRef.current, { cardId: card.id, score }];
    if (currentIndex + 1 >= queue.length) {
      onSessionComplete(resultsRef.current);
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