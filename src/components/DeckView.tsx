import { useEffect, useRef, useState } from 'react';
import type { Card, CardType, Deck, SessionIntensity, StudySession } from '../types';
import { getCardsForDeck, addCard, deleteCard, updateCard } from '../db';
import { buildSession } from '../lib/session';
import Reviewer from './Reviewer';
import ImageUploader from './ImageUploader';

interface Props {
  deck: Deck;
  onBack: () => void;
}

export default function DeckView({ deck, onBack }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [session, setSession] = useState<StudySession | null>(null);
  const [intensity, setIntensity] = useState<SessionIntensity>(20);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [cardType, setCardType] = useState<CardType>('basic');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [extra, setExtra] = useState('');
  const [extraImage, setExtraImage] = useState<string | null>(null);
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
    setCards(result as Card[]);
    setLoading(false);
  }

  async function handleAddCard() {
    if (cardType === 'basic') {
      const hasFrontContent = front.trim() || frontImage;
      const hasBackContent = back.trim() || backImage;
      if (!hasFrontContent && !hasBackContent) return;
      await addCard(deck.id, front.trim(), back.trim(), 'basic', frontImage, backImage, extra.trim() || null, extraImage);
    } else {
      const hasContent = front.trim() || frontImage;
      if (!hasContent) return;
      await addCard(deck.id, front.trim(), front.trim(), 'cloze', frontImage, backImage, extra.trim() || null, extraImage);
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
      const cursorPos = selected.length > 0
        ? start + selected.length + 6
        : start + 6;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }

  async function handleDelete(cardId: number) {
    await deleteCard(cardId);
    loadCards();
  }

  function startEditing(card: Card) {
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
    if (!editFront.trim() && !editFrontImage) return;
    await updateCard(cardId, editFront.trim(), editBack.trim(), editFrontImage, editBackImage, editImageSize, editExtra.trim() || null, editExtraImage);
    cancelEditing();
    loadCards();
  }

  function handleStartSession() {
    const queue = buildSession(cards, intensity);
    if (queue.length === 0) return;
    setSession({ deckId: deck.id, intensity, queue, currentIndex: 0 });
  }

  function handleSessionComplete() {
    setSession(null);
    loadCards();
  }

  const masteredCount = cards.filter(c => c.confidence_score === 5).length;
  const masteryPercent = cards.length > 0
    ? Math.round((masteredCount / cards.length) * 100)
    : 0;

  if (session) {
    return (
      <Reviewer
        session={session}
        onSessionComplete={handleSessionComplete}
        onExit={() => { setSession(null); loadCards(); }}
      />
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">

      {/* Header */}
      <button onClick={onBack} className="text-gray-400 hover:text-white mb-6 transition">
        ← Back
      </button>
      <h1 className="text-4xl font-bold mb-1">{deck.name}</h1>
      <p className="text-gray-400 mb-8">{cards.length} cards</p>

      {/* Mastery Bar */}
      {cards.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Mastery</span>
            <span>{masteryPercent}% at Level 5</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${masteryPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Session Launcher */}
      {cards.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <p className="text-gray-300 mb-4 font-semibold">Session Size</p>
          <div className="flex gap-3 mb-6">
            {([10, 20, 50] as SessionIntensity[]).map(n => (
              <button
                key={n}
                onClick={() => setIntensity(n)}
                className={`px-6 py-2 rounded-lg font-bold transition ${
                  intensity === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleStartSession}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-xl transition"
          >
            Start Session
          </button>
        </div>
      )}

      {/* Add Card Form */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-8">
        <p className="text-gray-300 mb-4 font-semibold">Add a Card</p>

        {/* Card Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCardType('basic')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              cardType === 'basic'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Basic
          </button>
          <button
            onClick={() => setCardType('cloze')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              cardType === 'cloze'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Cloze
          </button>
        </div>

        {cardType === 'basic' ? (
          <>
            <input
              type="text"
              placeholder="Front..."
              value={front}
              onChange={e => setFront(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <ImageUploader label="Front image (optional)" image={frontImage} onImage={setFrontImage} />
            <input
              type="text"
              placeholder="Back..."
              value={back}
              onChange={e => setBack(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <ImageUploader label="Back image (optional)" image={backImage} onImage={setBackImage} />
          </>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-2">
              Highlight a word then click <span className="text-purple-400 font-mono">{`{{ }}`}</span> to wrap it.
            </p>
            <textarea
              ref={frontRef}
              placeholder="e.g. The {{c1::capital}} of {{c2::France}} is {{c1::Paris}}"
              value={front}
              onChange={e => setFront(e.target.value)}
              rows={3}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-2 outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono"
            />
            <button
              onClick={handleClozeWrap}
              className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm font-mono font-semibold transition mb-4"
            >
              {`{{ }}`} Wrap Selection
            </button>
            <ImageUploader label="Image (optional)" image={frontImage} onImage={setFrontImage} />
          </>
        )}

        {/* Extra Field */}
        <div className="border-t border-gray-700 mt-4 pt-4">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Extra (optional — shown after answer)</p>
          <textarea
            placeholder="Additional notes, context, mnemonics..."
            value={extra}
            onChange={e => setExtra(e.target.value)}
            rows={2}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-3 outline-none focus:ring-2 focus:ring-gray-500 resize-none"
          />
          <ImageUploader label="Extra image (optional)" image={extraImage} onImage={setExtraImage} />
        </div>

        <button
          onClick={handleAddCard}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-semibold transition mt-2"
        >
          Add Card
        </button>
      </div>

      {/* Card List */}
      {cards.length > 0 && (
        <div className="space-y-3">
          <p className="text-gray-300 font-semibold mb-2">Cards in this deck</p>
          {cards.map(card => (
            <div key={card.id} className="bg-gray-800 rounded-xl p-4">
              {editingId === card.id ? (
                <div>
                  <input
                    type="text"
                    value={editFront}
                    onChange={e => setEditFront(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <ImageUploader label="Front image" image={editFrontImage} onImage={setEditFrontImage} />
                  {card.card_type === 'basic' && (
                    <>
                      <input
                        type="text"
                        value={editBack}
                        onChange={e => setEditBack(e.target.value)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ImageUploader label="Back image" image={editBackImage} onImage={setEditBackImage} />
                    </>
                  )}
                  {/* Image Size Slider */}
                  {(editFrontImage || editBackImage) && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Image size</span>
                        <span>{editImageSize}%</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={editImageSize}
                        onChange={e => setEditImageSize(Number(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  )}
                  {/* Extra */}
                  <div className="border-t border-gray-700 mt-3 pt-3">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Extra</p>
                    <textarea
                      value={editExtra}
                      onChange={e => setEditExtra(e.target.value)}
                      rows={2}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mb-2 outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                    />
                    <ImageUploader label="Extra image" image={editExtraImage} onImage={setEditExtraImage} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleSaveEdit(card.id)}
                      className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-semibold transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="bg-gray-600 hover:bg-gray-500 px-4 py-1.5 rounded-lg text-sm font-semibold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      {card.card_type === 'cloze' && (
                        <span className="text-xs bg-purple-800 text-purple-200 px-2 py-0.5 rounded-full">cloze</span>
                      )}
                      <p className="font-medium">{card.front}</p>
                    </div>
                    {card.card_type === 'basic' && (
                      <p className="text-gray-400 text-sm">{card.back}</p>
                    )}
                    {card.front_image && (
                      <img
                        src={card.front_image}
                        alt=""
                        className="mt-2 rounded-lg object-contain max-h-24"
                        style={{ width: `${card.image_size ?? 100}%` }}
                      />
                    )}
                    {card.extra && (
                      <p className="text-gray-500 text-xs mt-1 italic">{card.extra}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded-full">
                      Level {card.confidence_score}
                    </span>
                    <button
                      onClick={() => startEditing(card)}
                      className="text-gray-400 hover:text-white px-2 py-1 rounded transition text-lg"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="text-gray-400 hover:text-red-400 px-2 py-1 rounded transition text-lg"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}