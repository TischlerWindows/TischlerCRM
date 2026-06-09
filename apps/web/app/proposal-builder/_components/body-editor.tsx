'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';

export interface BodyEditorHandle {
  /** Insert text at the current cursor position. Used by the Variables chip panel. */
  insertText: (text: string) => void;
  /** Focus the editor. */
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Min-height for the editing area in pixels. */
  minHeight?: number;
}

interface ToolbarBtnProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}

function ToolbarBtn({ active, onClick, label, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${
        active
          ? 'bg-brand-navy/10 text-brand-navy'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Rich text body editor based on Tiptap's StarterKit.
 *
 * Emits HTML on every change. Token placeholders (`{{tokenName}}`) live in
 * the body as plain text — they're resolved at assembly time, not in the
 * editor. The Variables chip panel inserts these literal token strings at
 * the cursor via the exposed `insertText` handle.
 */
export const BodyEditor = forwardRef<BodyEditorHandle, Props>(function BodyEditor(
  { value, onChange, placeholder, minHeight = 180 },
  ref,
) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        // tiptap-prose-* selectors make body content look right without a global stylesheet
        class:
          'prose prose-sm max-w-none px-2.5 py-2 text-xs leading-relaxed focus:outline-none' +
          ' [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
      },
    },
    immediatelyRender: false,
  });

  // Keep editor content in sync if `value` changes externally (e.g. switching
  // between blocks). Only update when the incoming value differs from what
  // the editor already holds, otherwise Tiptap loses cursor position.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  useImperativeHandle(
    ref,
    (): BodyEditorHandle => ({
      insertText: (text: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(text).run();
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-brand-navy/20 focus-within:border-brand-navy/40">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-200 bg-gray-50">
        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="w-3 h-3" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="w-3 h-3" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden />
        <ToolbarBtn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bulleted list"
        >
          <List className="w-3 h-3" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrdered className="w-3 h-3" />
        </ToolbarBtn>
        {placeholder && (
          <span className="ml-auto text-[10px] text-gray-400 pr-1">{placeholder}</span>
        )}
      </div>
      <div style={{ minHeight, maxHeight: 300, overflowY: 'scroll', overscrollBehavior: 'contain' }}>
        <EditorContent editor={editor as Editor} />
      </div>
    </div>
  );
});
