import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/rich-text-editor-state.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
});
const { setRichTextEditable } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const documents = [
  {
    language: 'Vietnamese',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tin giải đấu' }] },
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Nội dung tiếng Việt cần được giữ nguyên.' }] },
      ],
    },
  },
  {
    language: 'English',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Tournament news' }] },
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'The English body must remain unchanged.' }] },
      ],
    },
  },
];

function createEditor(content, writes) {
  return new Editor({
    element: null,
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => writes.push(editor.getJSON()),
  });
}

test('default TipTap editability changes emit document updates even when the body is unchanged', () => {
  const writes = [];
  const editor = createEditor(documents[0].content, writes);
  try {
    const before = editor.getJSON();
    editor.setEditable(false);
    editor.setEditable(true);
    assert.deepEqual(writes, [before, before]);
    assert.deepEqual(editor.getJSON(), before);
  } finally {
    editor.destroy();
  }
});

for (const { language, content } of documents) {
  test(`silent editability changes preserve the ${language} body without form writes`, () => {
    const writes = [];
    const editor = createEditor(content, writes);
    try {
      const before = editor.getJSON();
      assert.deepEqual(JSON.parse(JSON.stringify(before)), content);
      for (const editable of [false, true, false, true]) {
        setRichTextEditable(editor, editable);
        assert.equal(editor.isEditable, editable);
        assert.deepEqual(editor.getJSON(), before);
        assert.deepEqual(writes, []);
      }
    } finally {
      editor.destroy();
    }
  });
}
