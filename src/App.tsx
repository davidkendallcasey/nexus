import { useEffect, useRef, useState } from 'react'
import {
  initDB, getDecks, createDeck, getDeckStats, getCardsForDecks,
  getGroups, createGroup, renameGroup, deleteGroup, moveDeckToGroup,
} from './db'
import type { Deck, DeckGroup, SessionResult } from './types'
import { buildSession } from './lib/session'
import DeckView from './components/DeckView'
import Reviewer from './components/Reviewer'
import SessionSummary from './components/SessionSummary'

interface DeckStat {
  totalCards: number;
  masteredCards: number;
  masteryPercent: number;
}

type AppView =
  | { kind: 'home' }
  | { kind: 'deck'; deck: Deck }
  | { kind: 'session'; deckIds: number[]; deckLabel: string; intensity: number }
  | { kind: 'summary'; deckLabel: string; results: SessionResult[]; deckIds: number[]; intensity: number }

export default function App() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [groups, setGroups] = useState<DeckGroup[]>([])
  const [stats, setStats] = useState<Record<number, DeckStat>>({})
  const [newDeckName, setNewDeckName] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<AppView>({ kind: 'home' })

  // ── Selection & session state ──────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [intensity, setIntensity] = useState(20)

  // ── Group UI state ─────────────────────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [assigningDeckId, setAssigningDeckId] = useState<number | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { initDB().then(() => loadAll()) }, [])

  useEffect(() => {
    if (showNewGroup) newGroupInputRef.current?.focus()
  }, [showNewGroup])

  useEffect(() => {
    if (renamingGroupId !== null) renameInputRef.current?.focus()
  }, [renamingGroupId])

  // Close assign dropdown when clicking outside
  useEffect(() => {
    if (assigningDeckId === null) return
    function handleClick() { setAssigningDeckId(null) }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [assigningDeckId])

  async function loadAll() {
    const [deckResult, groupResult, statsResult] = await Promise.all([
      getDecks(),
      getGroups(),
      getDeckStats(),
    ])
    setDecks(deckResult as Deck[])
    setGroups(groupResult)
    setStats(statsResult)
    // Expand all groups by default — preserve any the user has explicitly collapsed
    setExpandedGroups(prev => new Set([...prev, ...groupResult.map((g: DeckGroup) => g.id)]))
    setLoading(false)
  }

  // ── Deck operations ────────────────────────────────────────────────────────
  async function handleCreateDeck() {
    if (!newDeckName.trim()) return
    await createDeck(newDeckName.trim())
    setNewDeckName('')
    loadAll()
  }

  // ── Group operations ───────────────────────────────────────────────────────
  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    const group = await createGroup(newGroupName.trim())
    setNewGroupName('')
    setShowNewGroup(false)
    setExpandedGroups(prev => new Set([...prev, group.id]))
    loadAll()
  }

  async function handleRenameGroup(id: number) {
    if (!renameValue.trim()) { setRenamingGroupId(null); return }
    await renameGroup(id, renameValue.trim())
    setRenamingGroupId(null)
    loadAll()
  }

  async function handleDeleteGroup(id: number) {
    await deleteGroup(id)
    setExpandedGroups(prev => { const n = new Set(prev); n.delete(id); return n })
    loadAll()
  }

  async function handleMoveDeck(deckId: number, groupId: number | null) {
    await moveDeckToGroup(deckId, groupId)
    setAssigningDeckId(null)
    loadAll()
  }

  // ── Selection logic ────────────────────────────────────────────────────────
  function toggleDeck(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleGroup(groupId: number) {
    const groupDeckIds = decks.filter(d => d.group_id === groupId).map(d => d.id)
    const allSelected = groupDeckIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        groupDeckIds.forEach(id => next.delete(id))
      } else {
        groupDeckIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === decks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(decks.map(d => d.id)))
    }
  }

  function toggleExpanded(groupId: number) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  // ── Session ────────────────────────────────────────────────────────────────
  async function handleStartMultiSession() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const cards = await getCardsForDecks(ids)
    const queue = buildSession(cards, intensity)
    if (queue.length === 0) return
    const label = ids.length === 1
      ? decks.find(d => d.id === ids[0])?.name ?? 'Session'
      : `${ids.length} decks`
    setView({ kind: 'session', deckIds: ids, deckLabel: label, intensity })
  }

  const selectedTotalCards = [...selectedIds].reduce(
    (sum, id) => sum + (stats[id]?.totalCards ?? 0), 0
  )
  const maxIntensity = Math.min(100, Math.max(5, selectedTotalCards))
  const anySelected = selectedIds.size > 0
  const allSelected = decks.length > 0 && selectedIds.size === decks.length

  // ── Partitioned deck lists ─────────────────────────────────────────────────
  const ungroupedDecks = decks.filter(d => d.group_id === null)

  // ── Routing ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">Loading Nexus...</p>
    </div>
  )

  if (view.kind === 'deck') return (
    <DeckView deck={view.deck} onBack={() => { setView({ kind: 'home' }); loadAll() }} />
  )

  if (view.kind === 'session') return (
    <MultiDeckSessionRunner
      deckIds={view.deckIds}
      deckLabel={view.deckLabel}
      intensity={view.intensity}
      onComplete={(results) => {
        setView({ kind: 'summary', deckLabel: view.deckLabel, results, deckIds: view.deckIds, intensity: view.intensity })
        loadAll()
      }}
      onExit={() => { setView({ kind: 'home' }); loadAll() }}
    />
  )

  if (view.kind === 'summary') return (
    <SessionSummary
      results={view.results}
      deckName={view.deckLabel}
      onStudyAgain={() => setView({ kind: 'session', deckIds: view.deckIds, deckLabel: view.deckLabel, intensity: view.intensity })}
      onBackToDeck={() => setView({ kind: 'home' })}
    />
  )

  // ── Home screen ────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gray-950 text-white ${anySelected ? 'pb-52' : ''}`}>
      <div className="page-container">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="nexus-wordmark text-white mb-2">Nexus</h1>
          <p className="text-gray-500 text-sm tracking-wide uppercase">Your knowledge, on demand</p>
        </div>

        {/* Create Deck + New Group row */}
        <div className="flex gap-2 mb-10">
          <input
            type="text"
            placeholder="New deck name..."
            value={newDeckName}
            onChange={e => setNewDeckName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateDeck()}
            className="bg-gray-900 border border-gray-700 focus:border-blue-500 text-white px-4 py-2.5 rounded-lg flex-1 outline-none transition text-sm"
          />
          <button onClick={handleCreateDeck} className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg font-medium text-sm transition">
            + Deck
          </button>
          <button
            onClick={() => setShowNewGroup(v => !v)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white transition"
          >
            + Group
          </button>
        </div>

        {/* New group input */}
        {showNewGroup && (
          <div className="flex gap-2 mb-6 -mt-6">
            <input
              ref={newGroupInputRef}
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateGroup()
                if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupName('') }
              }}
              className="bg-gray-900 border border-gray-600 focus:border-blue-500 text-white px-4 py-2 rounded-lg flex-1 outline-none transition text-sm"
            />
            <button onClick={handleCreateGroup} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition">
              Create
            </button>
            <button onClick={() => { setShowNewGroup(false); setNewGroupName('') }} className="text-gray-600 hover:text-gray-400 px-2 transition text-lg">
              ✕
            </button>
          </div>
        )}

        {decks.length === 0 && groups.length === 0 ? (
          <p className="text-gray-600 text-center mt-20 text-sm tracking-wide">
            No decks yet — create one above.
          </p>
        ) : (
          <>
            {/* Select all */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={toggleAll}
                className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-2 uppercase tracking-wider"
              >
                <Checkbox checked={allSelected} indeterminate={!allSelected && anySelected} />
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              {anySelected && (
                <span className="text-xs text-blue-400 tracking-wide uppercase">
                  {selectedIds.size} {selectedIds.size === 1 ? 'deck' : 'decks'} selected
                </span>
              )}
            </div>

            {/* ── Groups ── */}
            {groups.map(group => {
              const groupDecks = decks.filter(d => d.group_id === group.id)
              const isExpanded = expandedGroups.has(group.id)
              const groupIds = groupDecks.map(d => d.id)
              const groupAllSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.has(id))
              const groupSomeSelected = groupIds.some(id => selectedIds.has(id))
              const groupTotalCards = groupDecks.reduce((s, d) => s + (stats[d.id]?.totalCards ?? 0), 0)
              const groupMastered = groupDecks.reduce((s, d) => s + (stats[d.id]?.masteredCards ?? 0), 0)
              const groupMasteryPercent = groupTotalCards > 0 ? Math.round((groupMastered / groupTotalCards) * 100) : 0

              return (
                <div key={group.id} className="mb-3">
                  {/* Group header row */}
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition
                    ${groupAllSelected ? 'bg-blue-950/20 border-blue-500/40' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                  >
                    {/* Group checkbox */}
                    <button onClick={() => toggleGroup(group.id)} className="flex-shrink-0">
                      <Checkbox checked={groupAllSelected} indeterminate={!groupAllSelected && groupSomeSelected} />
                    </button>

                    {/* Expand/collapse */}
                    <button
                      onClick={() => toggleExpanded(group.id)}
                      className="text-gray-500 hover:text-gray-300 transition text-xs flex-shrink-0 w-4"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>

                    {/* Group name / rename */}
                    {renamingGroupId === group.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameGroup(group.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameGroup(group.id)
                          if (e.key === 'Escape') setRenamingGroupId(null)
                        }}
                        className="flex-1 bg-transparent border-b border-gray-500 outline-none text-sm font-semibold text-white"
                      />
                    ) : (
                      <button
                        onClick={() => { setRenamingGroupId(group.id); setRenameValue(group.name) }}
                        className="flex-1 text-left text-sm font-semibold text-white hover:text-gray-300 transition"
                      >
                        {group.name}
                      </button>
                    )}

                    {/* Group stats */}
                    <span className="text-xs text-gray-600 flex-shrink-0">
                      {groupDecks.length} {groupDecks.length === 1 ? 'deck' : 'decks'}
                    </span>
                    {groupTotalCards > 0 && (
                      <span className="text-xs text-green-600 flex-shrink-0">{groupMasteryPercent}%</span>
                    )}

                    {/* Delete group */}
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-gray-700 hover:text-red-500 transition text-sm flex-shrink-0 ml-1"
                      title="Delete group (decks become ungrouped)"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Expanded deck list */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {groupDecks.length === 0 ? (
                        <p className="text-xs text-gray-600 px-4 py-2">No decks in this group yet.</p>
                      ) : (
                        groupDecks.map(deck => (
                          <DeckRow
                            key={deck.id}
                            deck={deck}
                            stat={stats[deck.id]}
                            isSelected={selectedIds.has(deck.id)}
                            onToggle={() => toggleDeck(deck.id)}
                            onOpen={() => setView({ kind: 'deck', deck })}
                            groups={groups}
                            assigningDeckId={assigningDeckId}
                            onAssignOpen={id => setAssigningDeckId(id)}
                            onAssign={handleMoveDeck}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* ── Ungrouped decks ── */}
            {ungroupedDecks.length > 0 && (
              <div className="mt-2">
                {groups.length > 0 && (
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-2 px-1">Ungrouped</p>
                )}
                <div className="space-y-1">
                  {ungroupedDecks.map(deck => (
                    <DeckRow
                      key={deck.id}
                      deck={deck}
                      stat={stats[deck.id]}
                      isSelected={selectedIds.has(deck.id)}
                      onToggle={() => toggleDeck(deck.id)}
                      onOpen={() => setView({ kind: 'deck', deck })}
                      groups={groups}
                      assigningDeckId={assigningDeckId}
                      onAssignOpen={id => setAssigningDeckId(id)}
                      onAssign={handleMoveDeck}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Sticky session bar ── */}
      {anySelected && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 px-6 py-4 z-50">
          <div className="max-w-xl mx-auto">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-sm text-gray-400 font-medium">Session size</p>
              <span className="text-lg font-bold text-blue-400">{Math.min(intensity, maxIntensity)}</span>
            </div>
            <input
              type="range"
              min={5}
              max={maxIntensity}
              value={Math.min(intensity, maxIntensity)}
              onChange={e => setIntensity(Number(e.target.value))}
              className="w-full accent-blue-500 mb-1"
            />
            <div className="flex justify-between text-xs text-gray-600 mb-3">
              <span>5</span>
              <span>{maxIntensity} available</span>
            </div>
            <button
              onClick={handleStartMultiSession}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm tracking-wide transition"
            >
              Start Session · {selectedIds.size} {selectedIds.size === 1 ? 'deck' : 'decks'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reusable Checkbox ──────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate }: { checked: boolean; indeterminate?: boolean }) {
  return (
    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition flex-shrink-0
      ${checked ? 'bg-blue-600 border-blue-600' : indeterminate ? 'bg-blue-900 border-blue-500' : 'border-gray-600'}`}
    >
      {checked && <span className="text-white text-xs leading-none">✓</span>}
      {!checked && indeterminate && <span className="text-blue-400 text-xs leading-none">–</span>}
    </span>
  )
}

// ── DeckRow ────────────────────────────────────────────────────────────────────
interface DeckRowProps {
  deck: Deck
  stat?: DeckStat
  isSelected: boolean
  onToggle: () => void
  onOpen: () => void
  groups: DeckGroup[]
  assigningDeckId: number | null
  onAssignOpen: (id: number) => void
  onAssign: (deckId: number, groupId: number | null) => void
}

function DeckRow({ deck, stat, isSelected, onToggle, onOpen, groups, assigningDeckId, onAssignOpen, onAssign }: DeckRowProps) {
  return (
    <div className={`group flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3.5 border transition
      ${isSelected ? 'border-blue-500/60 bg-blue-950/20' : 'border-gray-800 hover:border-gray-700'}`}
    >
      {/* Checkbox */}
      <button onClick={onToggle} className="flex-shrink-0">
        <Checkbox checked={isSelected} />
      </button>

      {/* Deck info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-sm text-white truncate">{deck.name}</span>
          {stat && (
            <span className="text-xs text-gray-600 flex-shrink-0">{stat.totalCards} {stat.totalCards === 1 ? 'card' : 'cards'}</span>
          )}
        </div>
        {stat && stat.totalCards > 0 && (
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1 bg-gray-800 rounded-full h-0.5">
              <div className="bg-green-500 h-0.5 rounded-full" style={{ width: `${stat.masteryPercent}%` }} />
            </div>
            <span className="text-xs text-green-600 flex-shrink-0 w-14 text-right">{stat.masteryPercent}% done</span>
          </div>
        )}
        {!stat && <p className="text-xs text-gray-700 mt-0.5">No cards yet</p>}
      </div>

      {/* Assign to group button + dropdown */}
      {groups.length > 0 && (
        <div className="relative flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onAssignOpen(assigningDeckId === deck.id ? -1 : deck.id) }}
            className="text-gray-700 hover:text-gray-400 transition text-xs px-1.5 py-1 rounded"
            title="Move to group"
          >
            ⊞
          </button>
          {assigningDeckId === deck.id && (
            <div
              className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-40 min-w-40 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Move to group</p>
              </div>
              {deck.group_id !== null && (
                <button
                  onClick={() => onAssign(deck.id, null)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 transition"
                >
                  Remove from group
                </button>
              )}
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => onAssign(deck.id, g.id)}
                  className={`w-full text-left px-3 py-2 text-sm transition
                    ${deck.group_id === g.id ? 'text-blue-400 bg-blue-950/30' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  {deck.group_id === g.id ? '✓ ' : ''}{g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onOpen}
        className="text-gray-700 text-xs flex-shrink-0 group-hover:text-gray-400 transition hover:text-white px-1"
        title="Open deck"
      >→</button>
    </div>
  )
}

// ── MultiDeckSessionRunner ─────────────────────────────────────────────────────
interface RunnerProps {
  deckIds: number[]
  deckLabel: string
  intensity: number
  onComplete: (results: SessionResult[]) => void
  onExit: () => void
}

function MultiDeckSessionRunner({ deckIds, intensity, onComplete, onExit }: RunnerProps) {
  const [session, setSession] = useState<import('./types').StudySession | null>(null)

  useEffect(() => {
    getCardsForDecks(deckIds).then(cards => {
      const queue = buildSession(cards, intensity)
      if (queue.length === 0) { onExit(); return }
      setSession({ deckIds, intensity, queue, currentIndex: 0 })
    })
  }, [])

  if (!session) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">Building session...</p>
    </div>
  )

  return <Reviewer session={session} onSessionComplete={onComplete} onExit={onExit} />
}