import { Create, Edit, useForm } from '@refinedev/antd';
import { Alert, App, Button, Flex, Form, Result, Skeleton } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { useUnsavedGuard } from '../../pages/ranking/ranking-rules-unsaved-guard';
import { ArticleFields, LAST_ARTICLE_CATEGORY_KEY } from './content-form-fields';
import { ArticlePublishActions } from './article-publish-actions';
import type { ContentStatus } from './content-labels';

const OPTIONAL_TEXT_FIELDS = ['titleEn', 'summary', 'summaryEn', 'bodyEn', 'category', 'categoryEn', 'authorName'];

export function ArticleEditor({ edit = false }: { edit?: boolean }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { form, query } = useForm({
    resource: 'articles', action: edit ? 'edit' : 'create', redirect: false, warnWhenUnsavedChanges: false,
    queryOptions: { refetchOnWindowFocus: false, refetchOnReconnect: false },
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [imageUploads, setImageUploads] = useState({ vi: false, en: false });
  const imageUploading = imageUploads.vi || imageUploads.en;
  const onImageUploadingChange = useCallback((locale: 'vi' | 'en', uploading: boolean) => {
    setImageUploads((current) => current[locale] === uploading ? current : { ...current, [locale]: uploading });
  }, []);
  const record = query?.data?.data;
  useUnsavedGuard(dirty || imageUploading, 'Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?');

  useEffect(() => {
    if (record) {
      const eventIds = Array.isArray(record.events) ? record.events.map((event: { eventId: string }) => event.eventId) : [];
      form.setFieldsValue({ ...record, eventIds });
      setDirty(false);
    }
  }, [record, form]);
  useEffect(() => {
    if (saved) navigate('/articles');
  }, [saved, navigate]);

  const validate = async () => {
    try { await form.validateFields(); return true; }
    catch { setLanguage('vi'); return false; }
  };
  const save = async (status: ContentStatus, publishAt: string | null = null) => {
    if (imageUploading) { message.warning('Chờ ảnh tải lên và xử lý xong trước khi lưu.'); return false; }
    if (!await validate()) return false;
    const values = form.getFieldsValue(true) as Record<string, unknown>;
    const payload: Record<string, unknown> = { ...values, body: values.body ?? '', eventIds: values.eventIds ?? [], status, publishAt };
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (values[field] === '' || values[field] === undefined) payload[field] = null;
    }
    setBusy(true);
    try {
      const response = await apiFetch(edit ? `/admin/articles/${encodeURIComponent(String(record?.id))}` : '/admin/articles', { method: edit ? 'PATCH' : 'POST', body: payload });
      try {
        if (typeof values.category === 'string') localStorage.setItem(LAST_ARTICLE_CATEGORY_KEY, values.category);
        else localStorage.removeItem(LAST_ARTICLE_CATEGORY_KEY);
      } catch { /* Storage may be unavailable. */ }
      showWarnings(message, warningsOf(response));
      message.success(status === 'SCHEDULED' ? 'Đã hẹn giờ đăng bài' : status === 'PUBLISHED' ? 'Đã đăng bài viết' : 'Đã lưu bài viết');
      setDirty(false);
      setSaved(true);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        form.setFields(Object.entries(error.errors).map(([name, text]) => ({ name, errors: [text] })));
        setLanguage(Object.keys(error.errors).some((key) => key.endsWith('En')) ? 'en' : 'vi');
      }
      message.error(error instanceof Error ? error.message : 'Không lưu được bài viết');
      return false;
    } finally { setBusy(false); }
  };

  if (edit && query?.isLoading) return <Skeleton active />;
  if (edit && (query?.isError || !record)) return <Result status="error" title="Không tải được bài viết" extra={<Button onClick={() => void query?.refetch()}>Thử lại</Button>} />;
  const content = <Form form={form} layout="vertical" disabled={busy} initialValues={{ status: 'DRAFT', isFeatured: false, eventIds: [] }} onValuesChange={() => setDirty(true)} onFinish={() => void save(form.getFieldValue('status') as ContentStatus, form.getFieldValue('publishAt') as string | null)}>
    <Flex vertical gap="middle">
      <Alert type="info" showIcon message="Lưu bản nháp trong lúc soạn. Bản dịch tiếng Anh có thể bổ sung sau." />
      <ArticleFields editing={edit} language={language} onLanguageChange={setLanguage} onImageUploadingChange={onImageUploadingChange} />
      <ArticlePublishActions form={form} busy={busy || imageUploading} validate={validate} save={save} />
    </Flex>
  </Form>;
  return edit ? <Edit title="Sửa bài viết" footerButtons={() => null} deleteButtonProps={{ hidden: true }}>{content}</Edit> : <Create title="Viết bài" footerButtons={() => null}>{content}</Create>;
}
