import type { ReactNode } from 'react';

export type ContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Bản nháp',
  SCHEDULED: 'Đã hẹn giờ',
  PUBLISHED: 'Đã đăng',
  ARCHIVED: 'Lưu trữ',
};
export const CONTENT_STATUS_COLORS: Record<ContentStatus, string | undefined> = {
  DRAFT: undefined,
  SCHEDULED: 'blue',
  PUBLISHED: 'green',
  ARCHIVED: 'orange',
};
export const CONTENT_STATUS_OPTIONS = Object.entries(CONTENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const IMMEDIATE_CONTENT_STATUS_OPTIONS = CONTENT_STATUS_OPTIONS.filter(({ value }) => value !== 'SCHEDULED');

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  summary?: string | null;
  summaryEn?: string | null;
  body: string;
  bodyEn?: string | null;
  coverMediaId?: string | null;
  category?: string | null;
  authorName?: string | null;
  isFeatured: boolean;
  status: ContentStatus;
  publishAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  events?: { id: string; name?: string; slug?: string }[];
}
export interface VideoRecord {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  url: string;
  provider: string;
  embedId: string;
  thumbnailUrl?: string | null;
  eventId?: string | null;
  isFeatured: boolean;
  status: ContentStatus;
  publishedAt?: string | null;
}
export interface SponsorRecord {
  id: string;
  name: string;
  logoMediaId?: string | null;
  logoDarkMediaId?: string | null;
  url?: string | null;
  roleLabel?: string | null;
  roleLabelEn?: string | null;
  eventId?: string | null;
  event?: { id: string; name: string } | null;
  order: number;
  isActive: boolean;
}
export interface StaticPageRecord {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  body: string;
  bodyEn?: string | null;
  status: ContentStatus;
  footerGroup?: string | null;
  footerOrder?: number | null;
}
export type ContactStatus = 'NEW' | 'READ' | 'ARCHIVED';
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = { NEW: 'Mới', READ: 'Đã đọc', ARCHIVED: 'Lưu trữ' };
export const CONTACT_STATUS_COLORS: Record<ContactStatus, string | undefined> = { NEW: 'red', READ: 'blue', ARCHIVED: undefined };
export const CONTACT_STATUS_OPTIONS = Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  message: string;
  status: ContactStatus;
  createdAt: string;
}
export function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—';
}
export function statusTag(status: ContentStatus | ContactStatus, labels: Record<string, string>, colors: Record<string, string | undefined>, Tag: (props: { color?: string; children: ReactNode }) => ReactNode) {
  return Tag({ color: colors[status], children: labels[status] ?? status });
}
