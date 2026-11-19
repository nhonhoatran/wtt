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
import Image from '@tiptap/extension-image';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Alert, Button, ConfigProvider, Flex, Input, Modal, theme, Tooltip, Typography } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { stripPastedImages, uploadRichTextImage } from './rich-text-image-upload';
import { setRichTextEditable } from './rich-text-editor-state';

interface RichTextFieldProps {
  value?: string | null;
  onChange?: (html: string) => void;
  minHeight?: number;
  onUploadingChange?: (uploading: boolean) => void;
}
const DEFAULT_MIN_HEIGHT = 200;
const SecureImage = Image.extend({
  addInputRules: () => [],
  parseHTML() {
    return [{ tag: 'img[src]', getAttrs: (node) => isHttpsUrl(node.getAttribute('src') ?? '') ? null : false }];
  },
});
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
export function RichTextField({ value, onChange, minHeight = DEFAULT_MIN_HEIGHT, onUploadingChange }: RichTextFieldProps) {
  const { token } = theme.useToken();
  const { componentDisabled } = ConfigProvider.useConfig();
  const [linkOpen, setLinkOpen] = useState(false);
  const [imagePhase, setImagePhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [imageError, setImageError] = useState<string>();
  const alive = useRef(true);
  const uploading = useRef(false);
  const uploadStatus = useRef(onUploadingChange);
  uploadStatus.current = onUploadingChange;
  const pasteImage = useRef<(file: File) => void>(() => undefined);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, protocols: ['https'], isAllowedUri: (url) => isHttpsUrl(url) }),
      SecureImage.configure({ allowBase64: false, HTMLAttributes: { style: 'max-width:100%;height:auto;' } }),
    ],
    content: value ?? '',
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => onChange?.(current.isEmpty ? '' : current.getHTML()),
    editorProps: {
      transformPastedHTML: stripPastedImages,
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        const file = files.find((item) => item.type.toLowerCase().startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        pasteImage.current(file);
        return true;
      },
    },
  });

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; uploadStatus.current?.(false); };
  }, []);

  pasteImage.current = (file: File) => {
    if (!editor || uploading.current || componentDisabled) return;
    if (!uploadStatus.current) { setImageError('Dán ảnh không được hỗ trợ tại đây.'); return; }
    const selection = editor.state.selection.from;
    uploading.current = true;
    setImageError(undefined);
    setImagePhase('uploading');
    uploadStatus.current?.(true);
    setRichTextEditable(editor, false);
    void uploadRichTextImage(file, { isActive: () => alive.current && !editor.isDestroyed, onPhase: (phase) => alive.current && setImagePhase(phase) })
      .then(({ src, alt }) => {
        if (!alive.current || editor.isDestroyed) return;
        editor.chain().insertContentAt(selection, { type: 'image', attrs: { src, alt } }).run();
      })
      .catch((error: unknown) => {
        if (alive.current) setImageError(error instanceof Error ? error.message : 'Không tải được ảnh.');
      })
      .finally(() => {
        uploading.current = false;
        uploadStatus.current?.(false);
        if (!alive.current || editor.isDestroyed) return;
        setImagePhase('idle');
      });
  };

  useEffect(() => {
    if (editor && !editor.isDestroyed) setRichTextEditable(editor, !componentDisabled && imagePhase === 'idle');
  }, [editor, componentDisabled, imagePhase]);

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
              disabled={tool.disabled || imagePhase !== 'idle'}
              aria-label={tool.label}
              onClick={tool.run}
            >
              {tool.text}
            </Button>
          </Tooltip>
        ))}
      </Flex>
      {imagePhase !== 'idle' && <Alert showIcon type="info" message={imagePhase === 'uploading' ? 'Đang tải ảnh lên…' : 'Đang xử lý ảnh…'} />}
      {imageError && <Alert showIcon type="error" message={imageError} closable onClose={() => setImageError(undefined)} />}
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
