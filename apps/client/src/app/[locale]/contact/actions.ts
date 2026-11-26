'use server';

import { API_GLOBAL_PREFIX, PUBLIC_API_SEGMENT, SSR_SECRET_HEADER, type ContactSubmission } from '@kamito/shared';
import { headers } from 'next/headers';
import { getDictionary } from '../../../i18n/get-dictionary';
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
  const copy = getDictionary(locale).contact;
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const organization = String(formData.get('organization') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const website = String(formData.get('website') ?? '').trim();
  if (website) return { status: 'success', message: copy.success };
  if (name.length < 2 || name.length > 120) return invalid(copy.validation.name, 'name');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid(copy.validation.email, 'email');
  if (phone.length > 40) return invalid(copy.validation.phone, 'phone');
  if (organization.length > 160) return invalid(copy.validation.organization, 'organization');
  if (message.length < 10 || message.length > 5000) return invalid(copy.validation.message, 'message');

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  if (ip === 'unknown') return { status: 'error', message: copy.error };

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
    if (response.status === 429) return { status: 'error', message: copy.rateLimited };
    if (!response.ok) return { status: 'error', message: copy.error };
    return { status: 'success', message: copy.success };
  } catch {
    return { status: 'error', message: copy.error };
  }
}
