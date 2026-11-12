import { useGetIdentity } from '@refinedev/core';
import type { CurrentUser } from './current-user';

/** Page size set on /settings; undefined lets the API apply its own default. */
export function useListPageSize(): number | undefined {
  return useGetIdentity<CurrentUser>().data?.listDefaultPageSize;
}
