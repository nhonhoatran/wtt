'use server';

import { API_GLOBAL_PREFIX, PUBLIC_API_SEGMENT, SSR_SECRET_HEADER, type ContactSubmission } from '@kamito/shared';
import { headers } from 'next/headers';
import { clientIp } from '../../../lib/public-rate-limit';
import { serverEnv } from '../../../lib/server-env';

export interface ContactActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

const invalid = (message: string, field?: string): ContactActionState => ({ status: 'error', message, ...(field ? { fieldErrors: { [field]: message } } : {}) });

export async function submitContact(_previous: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const locale = formData.get('locale') === 'en' ? 'en' : 'vi';
  const copy = locale === 'en'
    ? { success: 'Thank you. Your message has been received.', name: 'Enter a name between 2 and 120 characters.', email: 'Enter a valid email address.', phone: 'Phone number is too long.', organization: 'Organization name is too long.', message: 'Enter a message between 10 and 5000 characters.', rate: 'Too many messages. Try again in {seconds} seconds.', unavailable: 'Your message could not be sent. Please try again later.' }
    : { success: 'Cảm ơn bạn. Lời nhắn đã được gửi.', name: 'Vui lòng nhập họ tên từ 2 đến 120 ký tự.', email: 'Vui lòng nhập email hợp lệ.', phone: 'Số điện thoại quá dài.', organization: 'Tên đơn vị quá dài.', message: 'Nội dung cần từ 10 đến 5000 ký tự.', rate: 'Bạn gửi quá nhiều tin. Thử lại sau {seconds} giây.', unavailable: 'Chưa gửi được lời nhắn. Vui lòng thử lại sau.' };
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const organization = String(formData.get('organization') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const website = String(formData.get('website') ?? '').trim();
  if (website) return { status: 'success', message: copy.success };
  if (name.length < 2 || name.length > 120) return invalid(copy.name, 'name');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid(copy.email, 'email');
  if (phone.length > 40) return invalid(copy.phone, 'phone');
  if (organization.length > 160) return invalid(copy.organization, 'organization');
  if (message.length < 10 || message.length > 5000) return invalid(copy.message, 'message');

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  if (ip === 'unknown') return { status: 'error', message: copy.unavailable };

  const payload: ContactSubmission = { name, email, phone: phone || null, organization: organization || null, message };
  const base = serverEnv.apiInternalUrl().replace(/\/+$/, '');
  try {
    const response = await fetch(`${base}/${API_GLOBAL_PREFIX}/${PUBLIC_API_SEGMENT}/contact`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SSR_SECRET_HEADER]: serverEnv.ssrSecret(),
        'x-verified-client-ip': ip,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(serverEnv.apiTimeoutMs()),
    });
    if (response.status === 429) return { status: 'error', message: locale === 'vi' ? 'Bạn gửi quá nhiều tin. Vui lòng thử lại sau.' : 'Too many messages. Please try again later.' };
    if (!response.ok) return { status: 'error', message: copy.unavailable };
    return { status: 'success', message: copy.success };
  } catch {
    return { status: 'error', message: copy.unavailable };
  }
}
