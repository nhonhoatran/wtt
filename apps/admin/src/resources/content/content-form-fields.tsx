import { slugifyVietnamese } from '@kamito/shared';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Form, Input, InputNumber, Row, Select, Switch, Tabs, Typography, theme } from 'antd';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { MediaUploadField } from '../../components/media-upload-field';
import { RichTextField } from '../../components/rich-text-field';
import { IMMEDIATE_CONTENT_STATUS_OPTIONS } from './content-labels';
import { useContentEventOptions } from './use-content-event-options';

interface SettingsResponse { data: { key: string; value: unknown }[] }

export function useNewsCategories() {
  const query = useQuery({ queryKey: ['admin-settings', 'news.categories'], queryFn: () => apiFetch<SettingsResponse>('/admin/settings') });
  const raw = query.data?.data.find((item) => item.key === 'news.categories')?.value;
  const categories = Array.isArray(raw) ? raw.flatMap((item) => {
    if (typeof item === 'string') return [{ value: item, label: item }];
    if (item && typeof item === 'object' && 'code' in item && typeof item.code === 'string') {
      const row = item as { code: string; name?: string; label?: string };
      return [{ value: row.code, label: row.label ?? row.name ?? row.code }];
    }
    return [];
  }) : [];
  return { categories, loading: query.isLoading };
}

function SlugField({ sourceName, excludeId, editing }: { sourceName: string; excludeId?: string; editing?: boolean }) {
  const form = Form.useFormInstance();
  const source = Form.useWatch(sourceName, form) as string | undefined;
  const [manual, setManual] = useState(Boolean(excludeId) || Boolean(editing));
  useEffect(() => {
    if (!manual && source) form.setFieldValue('slug', slugifyVietnamese(source));
  }, [source, form, manual]);
  return <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Nhập slug' }, { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Dùng chữ thường không dấu, số và dấu gạch ngang' }]} extra="Tạo tự động từ tiêu đề; có thể chỉnh tay.">
    <Input autoComplete="off" onChange={() => setManual(true)} />
  </Form.Item>;
}

export const LAST_ARTICLE_CATEGORY_KEY = 'kamito.admin.articles.category';

export function ArticleFields({ editing, language, onLanguageChange, onImageUploadingChange }: {
  editing: boolean;
  language: 'vi' | 'en';
  onLanguageChange: (value: 'vi' | 'en') => void;
  onImageUploadingChange: (language: 'vi' | 'en', uploading: boolean) => void;
}) {
  const form = Form.useFormInstance();
  const { token } = theme.useToken();
  const { categories, loading } = useNewsCategories();
  const selectedEvents = Form.useWatch('eventIds', form) as string[] | undefined;
  const events = useContentEventOptions(selectedEvents);
  const titleEn = Form.useWatch('titleEn', form) as string | undefined;
  const bodyEn = Form.useWatch('bodyEn', form) as string | undefined;
  const missingEnglish = !titleEn?.trim() || !bodyEn?.trim();

  useEffect(() => {
    if (editing || loading || form.isFieldTouched('category') || form.getFieldValue('category')) return;
    try {
      const previousCategory = localStorage.getItem(LAST_ARTICLE_CATEGORY_KEY);
      if (categories.some(({ value }) => value === previousCategory)) form.setFieldValue('category', previousCategory);
    } catch {
      // Storage may be unavailable.
    }
  }, [categories, editing, loading, form]);

  return (
    <Row gutter={[token.margin, token.margin]}>
      <Col xs={24} lg={16}>
        <Card>
          <Tabs activeKey={language} onChange={(key) => onLanguageChange(key === 'en' ? 'en' : 'vi')} items={[
            { key: 'vi', label: 'Tiếng Việt', forceRender: true, children: <>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề' }]}>
                <Input autoFocus={!editing} maxLength={200} />
              </Form.Item>
              <SlugField sourceName="title" editing={editing} />
              <Form.Item name="summary" label="Tóm tắt"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
              <Form.Item name="body" label="Nội dung" extra="Dán ảnh từ clipboard để tải ảnh và chèn vào bài."><RichTextField minHeight={320} onUploadingChange={(uploading) => onImageUploadingChange('vi', uploading)} /></Form.Item>
            </> },
            { key: 'en', label: missingEnglish ? <Typography.Text type="warning">English · Chưa đủ bản dịch</Typography.Text> : 'English', forceRender: true, children: <>
              <Form.Item name="titleEn" label="Title"><Input maxLength={200} /></Form.Item>
              <Form.Item name="summaryEn" label="Summary"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
              <Form.Item name="categoryEn" label="Category label"><Input maxLength={80} /></Form.Item>
              <Form.Item name="bodyEn" label="Content" extra="Paste an image to upload and insert it."><RichTextField minHeight={320} onUploadingChange={(uploading) => onImageUploadingChange('en', uploading)} /></Form.Item>
            </> },
          ]} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Thông tin bài viết">
          <Form.Item name="category" label="Chuyên mục"><Select allowClear loading={loading} options={categories} placeholder="Chọn chuyên mục" /></Form.Item>
          <Form.Item name="coverMediaId" label="Ảnh bìa"><MediaUploadField purpose="article-cover" /></Form.Item>
          <Form.Item name="authorName" label="Tác giả"><Input maxLength={120} /></Form.Item>
          <Form.Item name="eventIds" label="Giải liên quan">
            <Select mode="multiple" {...events} placeholder="Tìm và chọn giải" maxTagCount="responsive" />
          </Form.Item>
          <Form.Item name="isFeatured" label="Nổi bật" valuePropName="checked"><Switch /></Form.Item>
        </Card>
      </Col>
    </Row>
  );
}

export function VideoFields({ record }: { record?: { id: string } }) {
  const form = Form.useFormInstance();
  const selectedEvent = Form.useWatch('eventId', form) as string | undefined;
  const events = useContentEventOptions(selectedEvent ? [selectedEvent] : []);
  return <>
    <Form.Item name="url" label="Liên kết video" rules={[{ required: true }, { type: 'url', message: 'Nhập liên kết hợp lệ' }]} extra="Chỉ dùng liên kết HTTPS từ nền tảng được máy chủ cho phép."><Input placeholder="https://" /></Form.Item>
    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true }]}><Input autoFocus maxLength={200} /></Form.Item>
    <SlugField sourceName="title" excludeId={record?.id} />
    <Form.Item name="titleEn" label="Title"><Input maxLength={200} /></Form.Item>
    <Form.Item name="durationText" label="Thời lượng hiển thị"><Input maxLength={30} placeholder="04:32" /></Form.Item>
    <Form.Item name="durationTextEn" label="Duration label"><Input maxLength={30} /></Form.Item>
    <Form.Item name="eventId" label="Giải liên quan"><Select allowClear {...events} placeholder="Không gắn giải" /></Form.Item>
    <Form.Item name="isFeatured" label="Nổi bật" valuePropName="checked"><Switch /></Form.Item>
    <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}><Select options={IMMEDIATE_CONTENT_STATUS_OPTIONS} /></Form.Item>
  </>;
}

export function StaticPageFields({ record, onImageUploadingChange }: { record?: { id: string }; onImageUploadingChange?: (locale: 'vi' | 'en', uploading: boolean) => void }) {
  return <>
    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true }]}><Input autoFocus maxLength={200} /></Form.Item>
    <SlugField sourceName="title" excludeId={record?.id} />
    <Form.Item name="titleEn" label="Title"><Input maxLength={200} /></Form.Item>
    <Form.Item name="body" label="Nội dung" rules={[{ required: true }]}><RichTextField minHeight={320} onUploadingChange={(value) => onImageUploadingChange?.('vi', value)} /></Form.Item>
    <Form.Item name="bodyEn" label="Content"><RichTextField minHeight={240} onUploadingChange={(value) => onImageUploadingChange?.('en', value)} /></Form.Item>
    <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}><Select options={IMMEDIATE_CONTENT_STATUS_OPTIONS} /></Form.Item>
    <Card title="Chân trang">
      <Form.Item name="footerGroup" label="Nhóm cột"><Input maxLength={60} /></Form.Item>
      <Form.Item name="footerGroupEn" label="Column group (English)"><Input maxLength={60} /></Form.Item>
      <Form.Item name="footerOrder" label="Thứ tự"><InputNumber min={0} precision={0} /></Form.Item>
    </Card>
  </>;
}
