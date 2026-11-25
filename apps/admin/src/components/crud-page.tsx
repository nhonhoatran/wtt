import { PlusOutlined } from '@ant-design/icons';
import { CreateButton as RefineCreateButton, Create as RefineCreate, Edit as RefineEdit, RefreshButton } from '@refinedev/antd';
import type { ComponentProps } from 'react';
import { ResourceBackLink } from './back-link';

// Refine's header arrow goes back in browser history; a named link to the list says where it leads.
export function Create(props: ComponentProps<typeof RefineCreate>) {
  return <RefineCreate goBack={false} breadcrumb={<ResourceBackLink />} {...props} />;
}

export function Edit(props: ComponentProps<typeof RefineEdit>) {
  // The back link already leads to the list, so the default "list" header button would be a second way to the same place.
  return (
    <RefineEdit
      goBack={false}
      breadcrumb={<ResourceBackLink />}
      headerButtons={({ refreshButtonProps }) => <RefreshButton {...refreshButtonProps} />}
      {...props}
    />
  );
}

/** Same icon as the in-page "Thêm …" buttons. */
export function CreateButton(props: ComponentProps<typeof RefineCreateButton>) {
  return <RefineCreateButton icon={<PlusOutlined />} {...props} />;
}
