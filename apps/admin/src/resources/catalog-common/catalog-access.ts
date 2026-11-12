import { useCan } from '@refinedev/core';

/** Catalogs, venues and events all sit under the "tournaments" permission resource. */
export function useCatalogAccess() {
  const canCreate = useCan({ resource: 'tournaments', action: 'create' }).data?.can ?? false;
  const canUpdate = useCan({ resource: 'tournaments', action: 'update' }).data?.can ?? false;
  const canDelete = useCan({ resource: 'tournaments', action: 'delete' }).data?.can ?? false;
  return { canCreate, canUpdate, canDelete };
}
