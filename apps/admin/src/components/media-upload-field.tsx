import { UploadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Flex, Image, Progress, Tag, Upload, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/http-client';
import { errorText, FAILURE_TEXT, PHASE_TAG, putContent, sleep, type Phase } from './media-upload-support';

export interface MediaUploadFieldProps {
  value?: string | null;
  onChange?: (mediaId: string | null) => void;
  purpose: string;
  previewUrl?: string | null;
  hint?: string;
}

interface MediaView {
  id: string;
  status: 'AWAITING_UPLOAD' | 'PROCESSING' | 'READY' | 'FAILED';
  failureReason: string | null;
  url: string | null;
}

interface IntentView {
  mediaId: string;
  uploadUrl: string;
}

interface UploadConfig {
  allowedTypes: string[];
  maxBytes: number;
}

/** Allowed types and the size cap are server settings; the file picker only mirrors them. */
const UPLOAD_CONFIG_STALE_MS = 60_000;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

/** Image picker for Form.Item: uploads straight to the API, waits for processing, then reports the media id. */
export function MediaUploadField({ value, onChange, purpose, previewUrl, hint }: MediaUploadFieldProps) {
  const { token } = theme.useToken();
  const [phase, setPhase] = useState<Phase>(value ? 'ready' : 'idle');
  const [url, setUrl] = useState<string | null>(previewUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const alive = useRef(true);
  const config = useQuery({
    queryKey: ['media-upload-config'],
    queryFn: async () => (await apiFetch<{ data: UploadConfig }>('/admin/media/config')).data,
    staleTime: UPLOAD_CONFIG_STALE_MS,
  }).data;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (previewUrl) setUrl(previewUrl);
  }, [previewUrl]);

  // An existing value without a known URL (edit form): look it up once.
  useEffect(() => {
    if (!value || url) return;
    apiFetch<{ data: MediaView }>(`/admin/media/${value}`)
      .then((res) => alive.current && setUrl(res.data.url))
      .catch(() => undefined);
  }, [value, url]);

  const poll = useCallback(
    async (mediaId: string) => {
      setPhase('processing');
      setError(null);
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (alive.current) {
        const { data } = await apiFetch<{ data: MediaView }>(`/admin/media/${mediaId}`);
        if (!alive.current) return;
        if (data.status === 'READY') {
          setUrl(data.url);
          setPhase('ready');
          setPendingId(null);
          onChange?.(mediaId);
          return;
        }
        if (data.status === 'FAILED') {
          setPhase('failed');
          setPendingId(null);
          setError(FAILURE_TEXT[data.failureReason ?? ''] ?? 'Không xử lý được ảnh.');
          return;
        }
        if (Date.now() + POLL_INTERVAL_MS > deadline) {
          setPhase('failed');
          setPendingId(mediaId);
          setError('Ảnh đang được xử lý lâu hơn dự kiến.');
          return;
        }
        await sleep(POLL_INTERVAL_MS);
      }
    },
    [onChange],
  );

  const start = async (file: File) => {
    if (config && file.size > config.maxBytes) {
      setError(`Ảnh tối đa ${Math.floor(config.maxBytes / BYTES_PER_MEGABYTE)} MB`);
      return;
    }
    setPhase('uploading');
    setError(null);
    setPendingId(null);
    try {
      const intent = await apiFetch<{ data: IntentView }>('/admin/media/intents', {
        method: 'POST',
        body: { purpose, contentType: file.type, size: file.size },
      });
      await putContent(intent.data.uploadUrl, file);
      await apiFetch(`/admin/media/${intent.data.mediaId}/complete`, { method: 'POST', body: {} });
      await poll(intent.data.mediaId);
    } catch (e) {
      if (!alive.current) return;
      setPhase(value ? 'ready' : 'failed');
      setError(errorText(e));
    }
  };

  const recheck = () => {
    if (pendingId) poll(pendingId).catch((e) => alive.current && setError(errorText(e)));
  };

  const remove = () => {
    setPhase('idle');
    setUrl(null);
    setError(null);
    setPendingId(null);
    onChange?.(null);
  };

  const busy = phase === 'uploading' || phase === 'processing';
  const tag = phase === 'idle' || (phase === 'ready' && !url) ? null : PHASE_TAG[phase];

  return (
    <Flex vertical gap="small" aria-live="polite">
      {value && url && phase === 'ready' && <Image src={url} alt="Ảnh đã chọn" style={{ maxHeight: token.controlHeight * 3, objectFit: 'contain' }} />}
      <Flex gap="small" align="center" wrap>
        <Upload accept={config?.allowedTypes.join(',')} showUploadList={false} disabled={busy} beforeUpload={(file) => { void start(file); return false; }}>
          <Button icon={<UploadOutlined />} loading={busy}>
            {value ? 'Đổi ảnh' : 'Chọn ảnh'}
          </Button>
        </Upload>
        {value && !busy && <Button onClick={remove}>Xóa ảnh</Button>}
        {tag && <Tag color={tag.color}>{tag.text}</Tag>}
      </Flex>
      {busy && <Progress percent={100} status="active" showInfo={false} size="small" />}
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={pendingId ? <Button size="small" onClick={recheck}>Kiểm tra lại</Button> : undefined}
        />
      )}
      {hint && <span style={{ color: token.colorTextSecondary }}>{hint}</span>}
    </Flex>
  );
}
