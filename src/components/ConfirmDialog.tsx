interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: Props) {
  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}
    >
      {/* Panel — stop clicks bubbling to backdrop */}
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-white font-semibold text-lg mb-2">{title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl text-sm transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}