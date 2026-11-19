import type { Editor } from '@tiptap/react';

export function setRichTextEditable(editor: Editor, editable: boolean): void {
  editor.setEditable(editable, false);
}
