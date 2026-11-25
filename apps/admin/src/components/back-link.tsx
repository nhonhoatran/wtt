import { ArrowLeftOutlined } from '@ant-design/icons';
import { useResourceParams } from '@refinedev/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** The one way back on every admin page: a link that names where it goes. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to}>
      <ArrowLeftOutlined /> {children}
    </Link>
  );
}

/** Back to the current resource's list, labelled with the list's menu name. */
export function ResourceBackLink() {
  const { resource } = useResourceParams();
  const list = resource?.list;
  if (typeof list !== 'string') return null;
  return <BackLink to={list}>{(resource?.meta?.label as string | undefined) ?? resource?.name}</BackLink>;
}
