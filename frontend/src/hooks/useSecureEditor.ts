import { useCallback } from 'react';

export function useSecureEditor() {
  const preventCopy = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  const preventContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const preventKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  }, []);

  const editorProps = {
    onCopy: preventCopy,
    onCut: preventCopy,
    onPaste: preventCopy,
    onContextMenu: preventContextMenu,
  };

  return { editorProps, preventKeyboardShortcuts };
}
