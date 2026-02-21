import { useEffect, useRef, useState } from 'react';
import type { CardWithNote, CardType, Deck, StudySession, SessionResult } from '../types';
import { getCardsForDeck, addCard, deleteCard, updateCard } from '../db';
import { buildSession } from '../lib/session';
import Reviewer from './Reviewer';
import SessionSummary from './SessionSummary';
import ImageUploader from './ImageUploader';
import CardEditor from './CardEditor';

interface Props {
  deck: Deck;
  onBack: () => void;
}

export default function DeckView({ deck, onBack }: Props) {
  const [cards, setCards] = useState<CardWithNote[]>([]);
  const [session, setSession] = useState<StudySession | null>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[] | null>(null);
  const [intensity, setIntensity] = useState(20);

  // ── Add card form state ───────────────────────────────────────────────────
  const [front, setFront] = useState('');        // HTML for basic, raw text for cloze
  const [back, setBack] = useState('');          // HTML
  const [cardType, setCardType] = useState<CardType>('basic');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [extra, setExtra] = useState('');        // HTML
  const [extraImage, setExtraImage] = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editFrontImage, setEditFrontImage] = useState<string | null>(null);
  const [editBackImage, setEditBackImage] = useState<string | null>(null);
  const [editImageSize, setEditImageSize] = useState(100);
  const [editExtra, setEditExtra] = useState('');
  const [editExtraImage, setEditExtraImage] = useState<string | null>(null);

  const frontRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadCards(); }, []);

  async function loadCards() {
    const result = await getCardsForDeck(deck.id);
    setCards(result);
    setLoading(false);
  }

  async function handleAddCard() {
    if (cardType === 'basic') {
      if (!front && !frontImage && !back && !backImage) return;
      await addCard(deck.id, front, back, 'basic', frontImage, backImage, extra || null, extraImage);
    } else {
      // Cloze: front is raw text with {{c1::token}} syntax
      if (!front.trim() && !frontImage) return;
      await addCard(deck.id, front.trim(), front.trim(), 'cloze', frontImage, backImage, extra || null, extraImage);
    }
    setFront('');
    setBack('');
    setFrontImage(null);
    setBackImage(null);
    setExtra('');
    setExtraImage(null);
    loadCards();
  }

  function handleClozeWrap() {
    const textarea = frontRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = front;
    const selected = text.slice(start, end);
    const newText = selected.length > 0
      ? text.slice(0, start) + `{{c1::${selected}}}` + text.slice(end)
      : text.slice(0, start) + `{{c1::}}` + text.slice(end);
    setFront(newText);
    setTimeout(() => {
      textarea.focus();
      const cursorPos = selected.length > 0 ? start + selected.length + 6 : start + 6;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }

  async function handleDelete(cardId: number) {
    await deleteCard(cardId);
    loadCards();
  }

  function startEditing(card: CardWithNote) {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditFrontImage(card.front_image);
    setEditBackImage(card.back_image);
    setEditImageSize(card.image_size ?? 100);
    setEditExtra(card.extra ?? '');
    setEditExtraImage(card.extra_image);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditFront('');
    setEditBack('');
    setEditFrontImage(null);
    setEditBackImage(null);
    setEditImageSize(100);
    setEditExtra('');
    setEditExtraImage(null);
  }

  async function handleSaveEdit(cardId: number) {
    if (!editFront && !editFrontImage) return;
    await updateCard(cardId, editFront, editBack, editFrontImage, editBackImage, editImageSize, editExtra || null, editExtraImage);
    cancelEditing();
    loadCards();
  }

  function handleStartSession() {
    const queue = buildSession(cards, intensity);
    if (queue.length === 0) return;
    setSessionResults(null);
    setSession({ deckIds: [deck.id], intensity, queue, currentIndex: 0 });
  }

  function handleSessionComplete(results: SessionResult[]) {
    setSession(null);
    setSessionResults(results);
    loadCards();
  }

  const masteredCount = cards.filter(c => c.confidence_score === 5).length;
  const masteryPercent = cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0;
  const maxIntensity = Math.min(100, Math.max(5, cards.length));

  if (session) {
    return (
      <Reviewer
        session={session}
        onSessionComplete={handleSessionComplete}
        onExit={() => { setSession(null); loadCards(); }}
      />
    );
  }

  if (sessionResults) {
    return (
      <SessionSummary
        results={sessionResults}
        deckName={deck.name}
        onStudyAgain={() => {
          setSessionResults(null);
          handleStartSession();
        }}
        onBackToDeck={() => setSessionResults(null)}
      />
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="page-container">

        {/* Header */}
        <div className="mb-10">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm transition flex items-center gap-1 mb-8">
            ← Back
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-1">{deck.name}</h1>
            <p className="text-gray-500 text-sm">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</p>
          </div>
        </div>

        {/* Mastery Bar */}
        {cards.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 uppercase tracking-wider mb-2">
              <span>Mastery</span>
              <span className="text-green-500">{masteryPercent}% at Level 5</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${masteryPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Session Launcher */}
        {cards.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-8">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-sm text-gray-400 font-medium">Session size</p>
              <span className="text-lg font-bold text-blue-400">{intensity}</span>
            </div>
            <input
              type="range"
              min={5}
              max={maxIntensity}
              value={Math.min(intensity, maxIntensity)}
              onChange={e => setIntensity(Number(e.target.value))}
              className="w-full accent-blue-500 mb-1"
            />
            <div className="flex justify-between text-xs text-gray-600 mb-4">
              <span>5</span>
              <span>{maxIntensity} available</span>
            </div>
            <button
              onClick={handleStartSession}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm tracking-wide transition"
            >
              Start Session
            </button>
          </div>
        )}

        {/* Add Card Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Add a Card</p>

          {/* Card Type Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setCardType('basic'); setFront(''); setBack(''); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                cardType === 'basic' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Basic
            </button>
            <button
              onClick={() => { setCardType('cloze'); setFront(''); setBack(''); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                cardType === 'cloze' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Cloze
            </button>
          </div>

          {cardType === 'basic' ? (
            <>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Front</p>
              <CardEditor value={front} onChange={setFront} placeholder="Front of card..." />
              <ImageUploader label="Front image (optional)" image={frontImage} onImage={setFrontImage} />
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1 mt-2">Back</p>
              <CardEditor value={back} onChange={setBack} placeholder="Back of card..." />
              <ImageUploader label="Back image (optional)" image={backImage} onImage={setBackImage} />
            </>
          ) : (
            <>
              <p className="text-gray-500 text-xs mb-2">
                Highlight a word then click <span className="text-purple-400 font-mono">{`{{ }}`}</span> to wrap it.
              </p>
              <textarea
                ref={frontRef}
                placeholder="e.g. The {{c1::capital}} of France is {{c1::Paris}}"
                value={front}
                onChange={e => setFront(e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg mb-2 outline-none focus:border-purple-500 transition resize-none font-mono text-sm"
              />
              <button
                onClick={handleClozeWrap}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wide transition mb-4"
              >
                {`{{ }}`} Wrap Selection
              </button>
              <ImageUploader label="Image (optional)" image={frontImage} onImage={setFrontImage} />
            </>
          )}

          <div className="border-t border-gray-800 mt-4 pt-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Extra</p>
            <CardEditor value={extra} onChange={setExtra} placeholder="Notes, mnemonics, context..." minHeight="60px" />
            <ImageUploader label="Extra image (optional)" image={extraImage} onImage={setExtraImage} />
          </div>

          <button
            onClick={handleAddCard}
            className="mt-3 bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg text-sm font-semibold transition"
          >
            Add Card
          </button>
        </div>

        {/* Card List */}
        {cards.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cards in this deck</p>
            <div className="space-y-2">
              {cards.map(card => (
                <div key={card.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  {editingId === card.id ? (
                    <div>
                      {card.card_type === 'basic' ? (
                        <>
                          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Front</p>
                          <CardEditor value={editFront} onChange={setEditFront} placeholder="Front..." />
                          <ImageUploader label="Front image" image={editFrontImage} onImage={setEditFrontImage} />
                          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1 mt-2">Back</p>
                          <CardEditor value={editBack} onChange={setEditBack} placeholder="Back..." />
                          <ImageUploader label="Back image" image={editBackImage} onImage={setEditBackImage} />
                        </>
                      ) : (
                        <input
                          type="text"
                          value={editFront}
                          onChange={e => setEditFront(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg mb-2 outline-none focus:border-blue-500 transition font-mono text-sm"
                        />
                      )}

                      {(editFrontImage || editBackImage) && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Image size</span>
                            <span>{editImageSize}%</span>
                          </div>
                          <input
                            type="range" min={20} max={100} value={editImageSize}
                            onChange={e => setEditImageSize(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>
                      )}

                      <div className="border-t border-gray-800 mt-3 pt-3">
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Extra</p>
                        <CardEditor value={editExtra} onChange={setEditExtra} placeholder="Extra notes..." minHeight="60px" />
                        <ImageUploader label="Extra image" image={editExtraImage} onImage={setEditExtraImage} />
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handleSaveEdit(card.id)} className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition">
                          Save
                        </button>
                        <button onClick={cancelEditing} className="bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {card.card_type === 'cloze' && (
                            <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">cloze</span>
                          )}
                          {card.card_type === 'basic'
                            ? <div className="card-content text-sm" dangerouslySetInnerHTML={{ __html: card.front }} />
                            : <p className="font-mono text-sm text-gray-300">{card.front}</p>
                          }
                        </div>
                        {card.front_image && (
                          <img src={card.front_image} alt="" className="mt-2 rounded-lg object-contain max-h-20" style={{ width: `${card.image_size ?? 100}%` }} />
                        )}
                        {card.extra && (
                          <div className="card-content text-gray-600 text-xs mt-1 italic" dangerouslySetInnerHTML={{ __html: card.extra }} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-600 tabular-nums">L{card.confidence_score}</span>
                        <button onClick={() => startEditing(card)} className="text-gray-600 hover:text-gray-300 transition text-base px-1">✎</button>
                        <button onClick={() => handleDelete(card.id)} className="text-gray-600 hover:text-red-400 transition text-base px-1">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}