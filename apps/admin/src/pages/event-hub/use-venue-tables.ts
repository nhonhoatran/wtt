import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/http-client';
import { useListPageSize } from '../../providers/use-list-page-size';
import type { VenueTableRecord } from '../../resources/venues/venue-table-modals';

/** Every active table of a venue in their `order`, fetched page by page. */
export function useVenueTables(venueId: string | null | undefined) {
  const pageSize = useListPageSize();
  return useQuery({
    queryKey: ['admin-venue-tables-active', venueId, pageSize],
    enabled: Boolean(venueId),
    queryFn: async () => {
      const rows: VenueTableRecord[] = [];
      for (let page = 1; ; page += 1) {
        const params = new URLSearchParams({ 'filter[isActive]': 'true', sort: 'order:asc', page: String(page) });
        if (pageSize) params.set('pageSize', String(pageSize));
        const res = await apiFetch<{ data: VenueTableRecord[]; total: number }>(`/admin/venues/${venueId}/tables?${params}`);
        rows.push(...res.data);
        if (res.data.length === 0 || rows.length >= res.total) return rows.sort((a, b) => a.order - b.order);
      }
    },
  });
}
