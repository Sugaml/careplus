import { useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Heading2,
  Quote,
  Eye,
  Edit3,
  Minus,
} from 'lucide-react';

type EditorMode = 'edit' | 'preview';

interface BlogRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export default function BlogRichEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  minHeight = '280px',
  className = '',
}: BlogRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<EditorMode>('edit');

  const applyFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value ?? undefined);
    editorRef.current?.focus();
  }, []);

  const insertLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (url) applyFormat('createLink', url);
  }, [applyFormat]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const empty = !el.innerHTML || el.innerHTML === '<br>';
    if (empty && value) {
      el.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html === '<br>' ? '' : html);
  }, [onChange]);

  return (
    <div className={`rounded-lg border border-theme-border bg-theme-bg overflow-hidden ${className}`}>
      <BlogEditorToolbar
        onBold={() => applyFormat('bold')}
        onItalic={() => applyFormat('italic')}
        onUnderline={() => applyFormat('underline')}
        onBulletList={() => applyFormat('insertUnorderedList')}
        onNumberedList={() => applyFormat('insertOrderedList')}
        onHeading={() => applyFormat('formatBlock', '<h2>')}
        onQuote={() => applyFormat('formatBlock', '<blockquote>')}
        onLink={insertLink}
        onHorizontalRule={() => applyFormat('insertHorizontalRule')}
      />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="blog-rich-editor prose prose-sm max-w-none dark:prose-invert p-4 outline-none focus:ring-0"
        style={{ minHeight }}
      />
      <style>{`
        .blog-rich-editor:empty::before { content: attr(data-placeholder); color: var(--theme-text-muted, #6b7280); }
        .blog-rich-editor h2 { font-size: 1.25rem; font-weight: 600; margin: 0.75em 0 0.25em; }
        .blog-rich-editor ul, .blog-rich-editor ol { padding-left: 1.5em; margin: 0.5em 0; }
        .blog-rich-editor blockquote { border-left: 4px solid var(--careplus-primary, #0d9488); padding-left: 1em; margin: 0.5em 0; color: var(--theme-text-muted); }
        .blog-rich-editor hr { border: none; border-top: 1px solid var(--theme-border); margin: 1em 0; }
      `}</style>
    </div>
  );
}

function BlogEditorToolbar({
  onBold,
  onItalic,
  onUnderline,
  onBulletList,
  onNumberedList,
  onHeading,
  onQuote,
  onLink,
  onHorizontalRule,
}: {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onHeading: () => void;
  onQuote: () => void;
  onLink: () => void;
  onHorizontalRule: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-theme-border bg-theme-bg-elevated">
      <ToolbarButton onClick={onBold} title="Bold" ariaLabel="Bold">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onItalic} title="Italic" ariaLabel="Italic">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onUnderline} title="Underline" ariaLabel="Underline">
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <span className="w-px h-5 bg-theme-border mx-1" aria-hidden />
      <ToolbarButton onClick={onHeading} title="Heading" ariaLabel="Heading">
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onQuote} title="Quote" ariaLabel="Quote">
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onBulletList} title="Bullet list" ariaLabel="Bullet list">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onNumberedList} title="Numbered list" ariaLabel="Numbered list">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onLink} title="Link" ariaLabel="Insert link">
        <Link className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onHorizontalRule} title="Horizontal line" ariaLabel="Horizontal line">
        <Minus className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-label={ariaLabel}
      className="p-2 rounded text-theme-text-muted hover:bg-theme-bg hover:text-theme-text transition-colors"
    >
      {children}
    </button>
  );
}

/** Preview-only view of HTML content (for Edit/Preview tab) */
export function BlogEditorPreview({ html, minHeight = '280px', className = '' }: { html: string; minHeight?: string; className?: string }) {
  return (
    <div
      className={`blog-editor-preview prose prose-sm max-w-none dark:prose-invert p-4 rounded-lg border border-theme-border bg-theme-bg ${className}`}
      style={{ minHeight }}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-theme-text-muted">Nothing to preview yet.</p>
      )}
    </div>
  );
}

/** Edit / Preview tab switcher for use with BlogRichEditor and BlogEditorPreview */
export function EditorPreviewTabs({
  mode,
  onModeChange,
  editLabel = 'Edit',
  previewLabel = 'Preview',
}: {
  mode: 'edit' | 'preview';
  onModeChange: (m: 'edit' | 'preview') => void;
  editLabel?: string;
  previewLabel?: string;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-theme-bg-elevated border border-theme-border w-fit mb-3">
      <button
        type="button"
        onClick={() => onModeChange('edit')}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'edit' ? 'bg-careplus-primary text-white' : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <Edit3 className="w-4 h-4" />
        {editLabel}
      </button>
      <button
        type="button"
        onClick={() => onModeChange('preview')}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'preview' ? 'bg-careplus-primary text-white' : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        <Eye className="w-4 h-4" />
        {previewLabel}
      </button>
    </div>
  );
}
