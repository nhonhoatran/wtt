import { Create, Edit, useForm } from '@refinedev/antd';
import { App, Flex, Form, Result, Skeleton, Button } from 'antd';
import { useNavigate } from 'react-router';
import { useCallback, useState } from 'react';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { StaticPageFields, VideoFields } from './content-form-fields';
import { ArticleEditor } from './article-editor';

function VideoEditor({ edit = false }: { edit?: boolean }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { formProps, form, saveButtonProps, query } = useForm({ resource: 'videos', action: edit ? 'edit' : 'create', redirect: false, onMutationSuccess: (response) => { showWarnings(message, warningsOf(response)); navigate('/videos'); } });
  const record = query?.data?.data;
  const fieldRecord = record?.id === undefined ? undefined : { id: String(record.id) };
  if (edit && query?.isLoading) return <Skeleton active />;
  if (edit && (query?.isError || !record)) return <Result status="error" title="Không tải được video" extra={<Button onClick={() => void query?.refetch()}>Thử lại</Button>} />;
  const content = <Form {...formProps} form={form} layout="vertical" initialValues={{ status: 'DRAFT', isFeatured: false, ...formProps.initialValues }}><Flex vertical gap="middle" style={{ maxWidth: 720 }}><VideoFields record={fieldRecord} /></Flex></Form>;
  return edit ? <Edit title="Sửa video" saveButtonProps={{ ...saveButtonProps, children: 'Lưu video' }} deleteButtonProps={{ hidden: true }}>{content}</Edit> : <Create title="Thêm video" saveButtonProps={{ ...saveButtonProps, children: 'Lưu video' }}>{content}</Create>;
}

function StaticPageEditor({ edit = false }: { edit?: boolean }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [uploads, setUploads] = useState({ vi: false, en: false });
  const imageUploading = uploads.vi || uploads.en;
  const onImageUploadingChange = useCallback((locale: 'vi' | 'en', uploading: boolean) => {
    setUploads((current) => current[locale] === uploading ? current : { ...current, [locale]: uploading });
  }, []);
  const { formProps, form, saveButtonProps, query } = useForm({ resource: 'static-pages', action: edit ? 'edit' : 'create', redirect: false, onMutationSuccess: (response) => { showWarnings(message, warningsOf(response)); navigate('/static-pages'); } });
  const record = query?.data?.data;
  const fieldRecord = record?.id === undefined ? undefined : { id: String(record.id) };
  if (edit && query?.isLoading) return <Skeleton active />;
  if (edit && (query?.isError || !record)) return <Result status="error" title="Không tải được trang tĩnh" extra={<Button onClick={() => void query?.refetch()}>Thử lại</Button>} />;
  const guardedSaveButton = { ...saveButtonProps, disabled: imageUploading || saveButtonProps.disabled, children: 'Lưu trang' };
  const content = <Form {...formProps} form={form} layout="vertical" initialValues={{ status: 'DRAFT', ...formProps.initialValues }} onFinish={(values) => {
    if (imageUploading) { message.warning('Chờ ảnh tải lên và xử lý xong trước khi lưu.'); return; }
    return formProps.onFinish?.(values);
  }}><Flex vertical gap="middle" style={{ maxWidth: 760 }}><StaticPageFields record={fieldRecord} onImageUploadingChange={onImageUploadingChange} /></Flex></Form>;
  return edit ? <Edit title="Sửa trang tĩnh" saveButtonProps={guardedSaveButton} deleteButtonProps={{ hidden: true }}>{content}</Edit> : <Create title="Thêm trang tĩnh" saveButtonProps={guardedSaveButton}>{content}</Create>;
}

export const ArticleCreate = () => <ArticleEditor />;
export const ArticleEdit = () => <ArticleEditor edit />;
export const VideoCreate = () => <VideoEditor />;
export const VideoEdit = () => <VideoEditor edit />;
export const StaticPageCreate = () => <StaticPageEditor />;
export const StaticPageEdit = () => <StaticPageEditor edit />;
