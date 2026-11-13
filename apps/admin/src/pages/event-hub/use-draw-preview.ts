import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import type { DrawKind, DrawPreview, DrawPreviewBody } from './draw-types';

/** Wait for the user to stop typing before asking the API to recompute the summary. */
export const DRAW_PREVIEW_DEBOUNCE_MS = 400;

export type DrawParamValues = Partial<Record<'seedCount' | 'qualifierCount' | 'groupCount' | 'groupSize' | 'advancePerGroup', number | null>>;

const postPreview = async (subEventId: string, body: DrawPreviewBody) =>
  (await apiFetch<{ data: DrawPreview }>(`/admin/sub-events/${subEventId}/draws/preview`, { method: 'POST', body })).data;

/** groupCount and groupSize both derive the other, so only the one the user edited last is sent. */
export function toPreviewBody(kind: DrawKind, values: DrawParamValues, groupField: 'groupCount' | 'groupSize'): DrawPreviewBody {
  const body: DrawPreviewBody = { kind };
  const keep: (keyof DrawParamValues)[] = ['seedCount', 'qualifierCount', 'advancePerGroup', groupField];
  for (const key of keep) {
    const value = values[key];
    if (typeof value === 'number') body[key] = value;
  }
  return body;
}

/**
 * First call sends only `kind` and the API answers with the defaults (from AppSetting draw.*);
 * later calls follow the form after a debounce. `body` is what a commit should send.
 */
export function useDrawPreview(subEventId: string, kind: DrawKind) {
  const [body, setBody] = useState<DrawPreviewBody | null>(null);
  const [debouncing, setDebouncing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const defaults = useQuery({
    queryKey: ['admin-draw-preview', subEventId, kind, 'defaults'],
    gcTime: 0,
    retry: false,
    queryFn: () => postPreview(subEventId, { kind }),
  });
  const live = useQuery({
    queryKey: ['admin-draw-preview', subEventId, kind, body],
    enabled: body !== null,
    gcTime: 0,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () => postPreview(subEventId, body!),
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = (next: DrawPreviewBody) => {
    setDebouncing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setBody(next);
      setDebouncing(false);
    }, DRAW_PREVIEW_DEBOUNCE_MS);
  };

  const failure = body !== null ? live.error : defaults.error;
  return {
    defaults: defaults.data,
    preview: live.data ?? defaults.data,
    loading: defaults.isLoading,
    calculating: debouncing || live.isFetching,
    error: failure ? (failure instanceof ApiError ? failure.message : 'Không tính được xem trước') : null,
    body: body ?? ({ kind } as DrawPreviewBody),
    schedule,
    refetch: () => (body !== null ? live.refetch() : defaults.refetch()),
  };
}
