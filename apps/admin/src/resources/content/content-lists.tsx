import { EditButton, getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { CanAccess } from '@refinedev/core';
import { Space, Table, Tag } from 'antd';
import { Link } from 'react-router';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { CONTENT_STATUS_COLORS, CONTENT_STATUS_LABELS, CONTENT_STATUS_OPTIONS, dateTime, type ArticleRecord, type StaticPageRecord, type VideoRecord } from './content-labels';
import { useNewsCategories } from './content-form-fields';
import { useTableScroll } from '../../components/use-table-scroll';

export function ArticleList() {
  const tableScroll = useTableScroll();
  const categorySettings = useNewsCategories();
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useTable<ArticleRecord>({ resource: 'articles', syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters: { initial: [{ field: 'createdAt', order: 'desc' }] } });
  return <List title="Tin tức" headerButtons={<CanAccess resource="content" action="create"><CreateButton>Thêm bài viết</CreateButton></CanAccess>}>
    <ListFilterBar searchForm={searchFormProps.form} filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tiêu đề hoặc slug' }, { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: CONTENT_STATUS_OPTIONS }, { kind: 'select', field: 'category', placeholder: 'Chuyên mục', options: categorySettings.categories }]} />
    <Table {...tableProps} rowKey="id" scroll={tableScroll}>
      <Table.Column<ArticleRecord> dataIndex="title" title="Tiêu đề" sorter defaultSortOrder={getDefaultSortOrder('title', sorters)} render={(title, row) => <Link to={`/articles/${row.id}/edit`}>{title}</Link>} />
      <Table.Column<ArticleRecord> dataIndex="category" title="Chuyên mục" render={(value) => value ?? '—'} />
      <Table.Column<ArticleRecord> dataIndex="status" title="Trạng thái" render={(status: ArticleRecord['status']) => <Tag color={CONTENT_STATUS_COLORS[status]}>{CONTENT_STATUS_LABELS[status]}</Tag>} />
      <Table.Column<ArticleRecord> dataIndex="publishAt" title="Lịch đăng" render={(value) => dateTime(value)} />
      <Table.Column<ArticleRecord> dataIndex="isFeatured" title="Nổi bật" render={(value) => value ? <Tag color="gold">Nổi bật</Tag> : '—'} />
      <Table.Column<ArticleRecord> key="actions" title="Thao tác" render={(_, row) => <Space><EditButton hideText size="small" recordItemId={row.id} /></Space>} />
    </Table>
  </List>;
}

export function VideoList() {
  const tableScroll = useTableScroll();
  const { tableProps, searchFormProps, filters, setFilters } = useTable<VideoRecord>({ resource: 'videos', syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters: { initial: [{ field: 'createdAt', order: 'desc' }] } });
  return <List title="Video" headerButtons={<CanAccess resource="content" action="create"><CreateButton>Thêm video</CreateButton></CanAccess>}>
    <ListFilterBar searchForm={searchFormProps.form} filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tiêu đề hoặc slug' }, { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: CONTENT_STATUS_OPTIONS }]} />
    <Table {...tableProps} rowKey="id" scroll={tableScroll}><Table.Column dataIndex="title" title="Tiêu đề" render={(title, row) => <Link to={`/videos/${row.id}/edit`}>{title}</Link>} /><Table.Column dataIndex="provider" title="Nền tảng" /><Table.Column dataIndex="status" title="Trạng thái" render={(status: ArticleRecord['status']) => <Tag color={CONTENT_STATUS_COLORS[status]}>{CONTENT_STATUS_LABELS[status]}</Tag>} /><Table.Column dataIndex="isFeatured" title="Nổi bật" render={(value) => value ? <Tag color="gold">Nổi bật</Tag> : '—'} /><Table.Column key="actions" title="Thao tác" render={(_, row) => <EditButton hideText size="small" recordItemId={row.id} />} /></Table>
  </List>;
}

export function StaticPageList() {
  const tableScroll = useTableScroll();
  const { tableProps, searchFormProps, filters, setFilters } = useTable<StaticPageRecord>({ resource: 'static-pages', syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters: { initial: [{ field: 'footerOrder', order: 'asc' }] } });
  return <List title="Trang tĩnh" headerButtons={<CanAccess resource="content" action="create"><CreateButton>Thêm trang</CreateButton></CanAccess>}>
    <ListFilterBar searchForm={searchFormProps.form} filters={filters} setFilters={setFilters} fields={[{ kind: 'search', field: 'q', placeholder: 'Tìm theo tiêu đề hoặc slug' }, { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: CONTENT_STATUS_OPTIONS }]} />
    <Table {...tableProps} rowKey="id" scroll={tableScroll}><Table.Column dataIndex="title" title="Tiêu đề" render={(title, row) => <Link to={`/static-pages/${row.id}/edit`}>{title}</Link>} /><Table.Column dataIndex="slug" title="Slug" /><Table.Column dataIndex="footerGroup" title="Nhóm footer" render={(v) => v ?? '—'} /><Table.Column dataIndex="status" title="Trạng thái" render={(status: ArticleRecord['status']) => <Tag color={CONTENT_STATUS_COLORS[status]}>{CONTENT_STATUS_LABELS[status]}</Tag>} /><Table.Column key="actions" title="Thao tác" render={(_, row) => <EditButton hideText size="small" recordItemId={row.id} />} /></Table>
  </List>;
}
