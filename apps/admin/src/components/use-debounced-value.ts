import { useEffect, useState } from 'react';

/** Lets the user finish a word before a search request goes out; fixed because it is a typing-feel constant, not a business setting. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Returns `value` after it has stayed unchanged for `ms`; lets the user finish typing before a request goes out. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
