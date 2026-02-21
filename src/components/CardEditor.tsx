import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useEffect } from 'react';

interface Props {
  value: string;           // HTML string
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => {
        // Prevent editor from losing focus when clicking toolbar
        e.preventDefault();
        onClick();
      }}
      className={`px-2 py-1 rounded text-sm font-medium transition
        ${isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-600 hover:text-white'
        }`}
    >
      {children}
    </button>
  );
}

export default function CardEditor({ value, onChange, placeholder = 'Type here...', minHeight = '80px' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      // Emit empty string instead of bare <p></p> so empty-check logic works
      const html = editor.isEmpty ? '' : editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'outline-none w-full',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external value changes (e.g. when parent resets the form after save)
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value]);

  if (!editor) return null;

  return (
    <div className="bg-gray-700 rounded-lg border border-transparent focus-within:border-blue-500 transition overflow-hidden mb-3">

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-gray-600 flex-wrap">

        {/* Text style */}
        <ToolbarButton
          title="Bold (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          title="Italic (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarButton
          title="Underline (Ctrl+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
        >
          <span className="underline">U</span>
        </ToolbarButton>

        <ToolbarButton
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
        >
          <span className="line-through">S</span>
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-600 mx-1" />

        {/* Lists */}
        <ToolbarButton
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
        >
          ≡
        </ToolbarButton>

        <ToolbarButton
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
        >
          1≡
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-600 mx-1" />

        {/* Code */}
        <ToolbarButton
          title="Inline code"
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
        >
          {'</>'}
        </ToolbarButton>

        <ToolbarButton
          title="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
        >
          {'{ }'}
        </ToolbarButton>

        <div className="w-px h-4 bg-gray-600 mx-1" />

        {/* Block level */}
        <ToolbarButton
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
        >
          "
        </ToolbarButton>

        <ToolbarButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          ✕
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="px-4 py-3 text-white editor-content">
        {editor.isEmpty && (
          <p className="text-gray-500 text-sm pointer-events-none absolute">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}