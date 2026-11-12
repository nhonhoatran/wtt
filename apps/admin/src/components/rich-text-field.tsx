import {
  BoldOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { isHttpsUrl } from '@kamito/shared';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button, Flex, Input, Modal, theme, Tooltip, Typography } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';

interface RichTextFieldProps {
  value?: string | null;
  onChange?: (html: string) => void;
  minHeight?: number;
}

const DEFAULT_MIN_HEIGHT = 200;

interface ToolDef {
  key: string;
  label: string;
  icon?: ReactNode;
  text?: string;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

function toolsFor(editor: Editor, openLink: () => void): ToolDef[] {
  const chain = () => editor.chain().focus();
  return [
    { key: 'bold', label: 'In đậm', icon: <BoldOutlined />, active: editor.isActive('bold'), run: () => chain().toggleBold().run() },
    { key: 'italic', label: 'In nghiêng', icon: <ItalicOutlined />, active: editor.isActive('italic'), run: () => chain().toggleItalic().run() },
    { key: 'h2', label: 'Tiêu đề lớn', text: 'H2', active: editor.isActive('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
    { key: 'h3', label: 'Tiêu đề nhỏ', text: 'H3', active: editor.isActive('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
    { key: 'ul', label: 'Danh sách gạch đầu dòng', icon: <UnorderedListOutlined />, active: editor.isActive('bulletList'), run: () => chain().toggleBulletList().run() },
    { key: 'ol', label: 'Danh sách đánh số', icon: <OrderedListOutlined />, active: editor.isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
    { key: 'link', label: 'Chèn liên kết', icon: <LinkOutlined />, active: editor.isActive('link'), run: openLink },
    { key: 'undo', label: 'Hoàn tác', icon: <UndoOutlined />, disabled: !editor.can().undo(), run: () => chain().undo().run() },
    { key: 'redo', label: 'Làm lại', icon: <RedoOutlined />, disabled: !editor.can().redo(), run: () => chain().redo().run() },
  ];
}

function LinkModal({ editor, open, onClose }: { editor: Editor; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
    setError(undefined);
  }, [open, editor]);

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else if (isHttpsUrl(trimmed)) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    } else {
      setError('Chỉ nhận đường dẫn bắt đầu bằng https://');
      return;
    }
    onClose();
  };

  return (
    <Modal title="Chèn liên kết" open={open} onOk={apply} onCancel={onClose} okText="Áp dụng" cancelText="Hủy" destroyOnHidden>
      <Input
        autoFocus
        placeholder="https://"
        value={url}
        status={error ? 'error' : undefined}
        onChange={(event) => setUrl(event.target.value)}
        onPressEnter={apply}
      />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </Modal>
  );
}

/** HTML string in/out so it works inside Form.Item; the API sanitizes what it stores. */
export function RichTextField({ value, onChange, minHeight = DEFAULT_MIN_HEIGHT }: RichTextFieldProps) {
  const { token } = theme.useToken();
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, protocols: ['https'], isAllowedUri: (url) => isHttpsUrl(url) }),
    ],
    content: value ?? '',
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => onChange?.(current.isEmpty ? '' : current.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const incoming = value ?? '';
    if (incoming !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div style={{ border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius }}>
      <Flex wrap gap={token.marginXXS} style={{ padding: token.paddingXS, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        {toolsFor(editor, () => setLinkOpen(true)).map((tool) => (
          <Tooltip key={tool.key} title={tool.label}>
            <Button
              size="small"
              type={tool.active ? 'primary' : 'default'}
              icon={tool.icon}
              disabled={tool.disabled}
              aria-label={tool.label}
              onClick={tool.run}
            >
              {tool.text}
            </Button>
          </Tooltip>
        ))}
      </Flex>
      <EditorContent
        editor={editor}
        style={{ padding: token.padding, minHeight }}
        // ProseMirror renders the editable area as a child; keep the whole box clickable.
        onClick={() => editor.chain().focus().run()}
      />
      <LinkModal editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </div>
  );
}
