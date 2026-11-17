import { useCan } from '@refinedev/core';

/** Catalogs, venues and events sit under "tournaments"; other catalog-like screens pass their own permission resource. */
export function useCatalogAccess(permission = 'tournaments') {
  const canCreate = useCan({ resource: permission, action: 'create' }).data?.can ?? false;
  const canUpdate = useCan({ resource: permission, action: 'update' }).data?.can ?? false;
  const canDelete = useCan({ resource: permission, action: 'delete' }).data?.can ?? false;
  return { canCreate, canUpdate, canDelete };
}
