import type { SessionResult, ConfidenceScore } from '../types';

interface Props {
  results: SessionResult[];
  deckName: string;
  onStudyAgain: () => void;
  onBackToDeck: () => void;
}

const SCORE_META: Record<ConfidenceScore, { label: string; color: string; bg: string }> = {
  0: { label: 'Unseen',   color: 'text-gray-400',   bg: 'bg-gray-700' },
  1: { label: 'Clueless', color: 'text-red-400',    bg: 'bg-red-900' },
  2: { label: 'Barely',   color: 'text-orange-400', bg: 'bg-orange-900' },
  3: { label: 'Familiar', color: 'text-yellow-400', bg: 'bg-yellow-900' },
  4: { label: 'Good',     color: 'text-lime-400',   bg: 'bg-lime-900' },
  5: { label: 'Mastered', color: 'text-green-400',  bg: 'bg-green-900' },
};

export default function SessionSummary({ results, deckName, onStudyAgain, onBackToDeck }: Props) {
  const total = results.length;

  // Count how many cards were graded at each score level
  const counts = ([1, 2, 3, 4, 5] as ConfidenceScore[]).map(score => ({
    score,
    count: results.filter(r => r.score === score).length,
    ...SCORE_META[score],
  }));

  // A simple "quality score" — weighted average of grades, normalised to 0-100
  const weightedAvg = total > 0
    ? Math.round((results.reduce((sum, r) => sum + r.score, 0) / (total * 5)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">
            {weightedAvg >= 80 ? '🏆' : weightedAvg >= 60 ? '💪' : weightedAvg >= 40 ? '📖' : '🔁'}
          </div>
          <h1 className="text-3xl font-bold mb-1">Session Complete</h1>
          <p className="text-gray-400">{deckName}</p>
        </div>

        {/* Score ring / summary */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6 text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Cards Reviewed</p>
          <p className="text-6xl font-bold text-white mb-4">{total}</p>
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 flex-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-2 bg-green-500 rounded-full transition-all duration-700"
                style={{ width: `${weightedAvg}%` }}
              />
            </div>
            <span className="text-green-400 font-bold text-sm w-12 text-right">{weightedAvg}%</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Session quality score</p>
        </div>

        {/* Grade breakdown */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8 space-y-3">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-4">Grade Breakdown</p>
          {counts.map(({ score, count, label, color, bg }) => (
            <div key={score} className="flex items-center gap-3">
              <span className={`text-xs font-bold w-6 h-6 rounded flex items-center justify-center ${bg} ${color}`}>
                {score}
              </span>
              <span className={`text-sm font-medium w-20 ${color}`}>{label}</span>
              {/* Bar */}
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${bg.replace('bg-', 'bg-').replace('-900', '-500')}`}
                  style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-gray-400 text-sm w-6 text-right">{count}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onStudyAgain}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-lg transition"
          >
            Study Again
          </button>
          <button
            onClick={onBackToDeck}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl text-lg transition"
          >
            Back to Deck
          </button>
        </div>

      </div>
    </div>
  );
}