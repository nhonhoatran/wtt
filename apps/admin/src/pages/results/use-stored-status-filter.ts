import { useState } from 'react';
import { STATUS_FILTER_OPTIONS, type MatchStatusFilter } from './match-types';

const STATUS_STORAGE_KEY = 'kamito.admin.results.status';
const DEFAULT_STATUS: MatchStatusFilter = 'OPEN';

const isStatus = (value: string | null): value is MatchStatusFilter => STATUS_FILTER_OPTIONS.some((option) => option.value === value);

const readStoredStatus = (): MatchStatusFilter => {
  try {
    const stored = localStorage.getItem(STATUS_STORAGE_KEY);
    return isStatus(stored) ? stored : DEFAULT_STATUS;
  } catch {
    return DEFAULT_STATUS;
  }
};

/** Status filter of the results list, remembered across visits. */
export function useStoredStatusFilter(): [MatchStatusFilter, (status: MatchStatusFilter) => void] {
  const [status, setStatus] = useState<MatchStatusFilter>(readStoredStatus);
  const update = (next: MatchStatusFilter) => {
    setStatus(next);
    try {
      localStorage.setItem(STATUS_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice just is not remembered.
    }
  };
  return [status, update];
}
