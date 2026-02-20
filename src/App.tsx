import { useEffect, useState } from 'react'
import { initDB, getDecks, createDeck } from './db'
import type { Deck } from './types'
import DeckView from './components/DeckView'

export default function App() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [newDeckName, setNewDeckName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)

  useEffect(() => {
    initDB().then(() => {
      loadDecks()
    })
  }, [])

  async function loadDecks() {
    const result = await getDecks()
    setDecks(result as Deck[])
    setLoading(false)
  }

  async function handleCreateDeck() {
    if (!newDeckName.trim()) return
    await createDeck(newDeckName.trim())
    setNewDeckName('')
    loadDecks()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">Loading Nexus...</p>
    </div>
  )

  if (selectedDeck) return (
    <DeckView
      deck={selectedDeck}
      onBack={() => {
        setSelectedDeck(null)
        loadDecks()
      }}
    />
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-2">Nexus</h1>
      <p className="text-gray-400 mb-8">Your knowledge, on demand.</p>

      {/* Create Deck */}
      <div className="flex gap-3 mb-10">
        <input
          type="text"
          placeholder="New deck name..."
          value={newDeckName}
          onChange={e => setNewDeckName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateDeck()}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreateDeck}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-semibold transition"
        >
          Create Deck
        </button>
      </div>

      {/* Deck List */}
      {decks.length === 0 ? (
        <p className="text-gray-500 text-center mt-20 text-lg">
          No decks yet. Create your first deck above.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <div
              key={deck.id}
              onClick={() => setSelectedDeck(deck)}
              className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition cursor-pointer"
            >
              <h2 className="text-xl font-semibold">{deck.name}</h2>
              <p className="text-gray-400 text-sm mt-1">Click to study →</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}