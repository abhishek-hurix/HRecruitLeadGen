import Editor, { type OnMount } from '@monaco-editor/react';
import { useSecureEditor } from '../../hooks/useSecureEditor';
import { useEffect } from 'react';

interface CodeEditorProps {
  language: 'python' | 'javascript';
  value: string;
  onChange: (value: string) => void;
  theme?: 'vs-dark' | 'light';
}

export function CodeEditor({ language, value, onChange, theme = 'vs-dark' }: CodeEditorProps) {
  const { preventKeyboardShortcuts } = useSecureEditor();

  useEffect(() => {
    document.addEventListener('keydown', preventKeyboardShortcuts);
    return () => document.removeEventListener('keydown', preventKeyboardShortcuts);
  }, [preventKeyboardShortcuts]);

  const handleMount: OnMount = (editor) => {
    editor.focus();
  };

  return (
    <div className="h-full min-h-[420px] border border-slate-700 rounded-lg overflow-hidden">
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={theme}
        onMount={handleMount}
        onChange={(v) => onChange(v || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          readOnly: false,
          contextmenu: false,
        }}
      />
    </div>
  );
}
