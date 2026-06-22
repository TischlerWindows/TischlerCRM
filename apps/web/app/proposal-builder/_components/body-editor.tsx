'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { Extension } from '@tiptap/core';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';

// Custom font-size extension built on TextStyle (TipTap v2 compatible).
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize?.replace('pt', '') || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}pt` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24'];
const DEFAULT_SIZE = '10';

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
  /** Called when the editor receives focus. */
  onFocus?: () => void;
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
  { value, onChange, placeholder, minHeight = 180, onFocus },
  ref,
) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Underline, FontSize],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        // tiptap-prose-* selectors make body content look right without a global stylesheet
        class:
          'prose prose-sm max-w-none px-2.5 py-2 text-xs leading-relaxed focus:outline-none' +
          ' [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
      },
      // ProseMirror normalizes runs of ASCII spaces to a single space.
      // When the user presses Space and the character immediately before the
      // cursor is already a space (or a non-breaking space), insert a
      // non-breaking space (\u00A0) instead so ProseMirror preserves it.
      handleKeyDown: (view, event) => {
        if (event.key !== ' ') return false;
        const { state, dispatch } = view;
        const { $from } = state.selection;
        const textBefore = $from.nodeBefore?.text ?? '';
        const charBefore = textBefore[textBefore.length - 1];
        if (charBefore === ' ' || charBefore === '\u00A0') {
          dispatch(state.tr.insertText('\u00A0'));
          return true;
        }
        return false;
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
    <div
        className="border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-brand-navy/20 focus-within:border-brand-navy/40"
        onFocus={onFocus}
      >
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
        <ToolbarBtn
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          label="Underline"
        >
          <UnderlineIcon className="w-3 h-3" />
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
        <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden />
        {/* Font size selector */}
        <select
          aria-label="Font size"
          value={editor.getAttributes('textStyle').fontSize ?? DEFAULT_SIZE}
          onChange={(e) => {
            const val = e.target.value;
            if (val === DEFAULT_SIZE) {
              (editor.chain().focus() as any).unsetFontSize().run();
            } else {
              (editor.chain().focus() as any).setFontSize(val).run();
            }
          }}
          className="text-[10px] h-6 rounded border border-gray-300 bg-white px-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-navy/30"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}pt</option>
          ))}
        </select>
        {placeholder && (
          <span className="ml-auto text-[10px] text-gray-400 pr-1">{placeholder}</span>
        )}
      </div>
      <div
        style={{ minHeight, maxHeight: 200, overflowY: 'scroll', overscrollBehavior: 'contain' }}
        onWheel={(e) => {
          // If the editor is scrolled to its limit, let the event propagate
          // to the parent scroll container instead of being swallowed.
          const el = e.currentTarget;
          const atTop = el.scrollTop === 0 && e.deltaY < 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
          if (atTop || atBottom) {
            e.stopPropagation();
            const panel = el.closest('[data-scroll-panel]');
            if (panel) panel.scrollTop += e.deltaY;
          }
        }}
      >
        <EditorContent editor={editor as Editor} />
      </div>
    </div>
  );
});
