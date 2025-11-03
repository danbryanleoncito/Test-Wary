import { useState, useCallback, useEffect } from 'react';
import { debounce } from '@repo/shared';

interface EditorProps {
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  autoSave?: boolean;
}

export default function Editor({
  initialContent = '',
  onSave,
  autoSave = true,
}: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Debounced auto-save
  const debouncedSave = useCallback(
    debounce(async (text: string) => {
      if (onSave && autoSave) {
        setSaving(true);
        try {
          await onSave(text);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setSaving(false);
        }
      }
    }, 2000),
    [onSave, autoSave]
  );

  useEffect(() => {
    if (content !== initialContent) {
      debouncedSave(content);
    }
  }, [content, debouncedSave, initialContent]);

  const handleSave = async () => {
    if (!onSave) return;

    setSaving(true);
    try {
      await onSave(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    const newContent =
      content.substring(0, start) +
      before +
      selectedText +
      after +
      content.substring(end);

    setContent(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        end + before.length
      );
    }, 0);
  };

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h2>Rich Text Editor</h2>
        <div className="editor-actions">
          {autoSave && (
            <span className="auto-save-status">
              {saving && 'Saving...'}
              {saved && '✓ Saved'}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="save-button"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-toolbar">
        <button
          onClick={() => insertMarkdown('**', '**')}
          title="Bold"
          className="toolbar-btn"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => insertMarkdown('*', '*')}
          title="Italic"
          className="toolbar-btn"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => insertMarkdown('## ', '')}
          title="Heading"
          className="toolbar-btn"
        >
          H2
        </button>
        <button
          onClick={() => insertMarkdown('[', '](url)')}
          title="Link"
          className="toolbar-btn"
        >
          🔗
        </button>
        <button
          onClick={() => insertMarkdown('```\n', '\n```')}
          title="Code Block"
          className="toolbar-btn"
        >
          {'</>'}
        </button>
      </div>

      <div className="editor-main">
        <div className="editor-pane">
          <label htmlFor="title-input">Title</label>
          <input
            id="title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title..."
            className="title-input"
          />

          <label htmlFor="editor-textarea">Content (Markdown)</label>
          <textarea
            id="editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your content in Markdown..."
            className="editor-textarea"
          />
        </div>

        <div className="preview-pane">
          <h3>Preview</h3>
          <div className="preview-content">
            {title && <h1>{title}</h1>}
            <div
              dangerouslySetInnerHTML={{
                __html: content.replace(/\n/g, '<br />'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
