import { useRef } from 'react';

interface Props {
  label: string;
  image: string | null;
  onImage: (base64: string | null) => void;
}

export default function ImageUploader({ label, image, onImage }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = [...e.clipboardData.items].find(i => i.type.startsWith('image'));
    if (item) {
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image'));
    if (file) handleFile(file);
  }

  return (
    <div className="mb-3">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {image ? (
        <div className="relative">
          <img
            src={image}
            alt="card"
            className="w-full max-h-48 object-contain rounded-lg bg-gray-900"
          />
          <button
            onClick={() => onImage(null)}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-600 hover:border-gray-400 rounded-lg p-6 text-center cursor-pointer transition text-gray-500 hover:text-gray-300"
        >
          <p className="text-sm">Click to upload, drag & drop, or <span className="text-blue-400">Ctrl+V</span> to paste</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}
    </div>
  );
}