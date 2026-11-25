import { List } from '@refinedev/antd';
import { CreateButton } from '../../components/crud-page';
import { Table, Tag } from 'antd';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { ACTIVE_FILTER_OPTIONS, actionsColumn, sortColumn, statusColumn, useCatalogTable } from '../catalog-common/catalog-table';
import { UNFINISHED_OPTIONS, type GroupScoringRuleRecord } from './group-scoring-rule-form';
import { useTableScroll } from '../../components/use-table-scroll';

const RESOURCE = 'group-scoring-rules';
const unfinishedLabel = (value: GroupScoringRuleRecord['unfinishedMatchScoring']) =>
  UNFINISHED_OPTIONS.find((option) => option.value === value)?.label ?? value;

export function GroupScoringRuleList() {
  const tableScroll = useTableScroll();
  const { canCreate } = useCatalogAccess();
  const { tableProps, searchFormProps, sorters, filters, setFilters } = useCatalogTable<GroupScoringRuleRecord>(RESOURCE, { field: 'name', order: 'asc' });

  return (
    <List title="Luật vòng bảng" headerButtons={canCreate ? <CreateButton resource={RESOURCE}>Thêm luật</CreateButton> : undefined}>
      <ListFilterBar searchForm={searchFormProps.form}
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'search', field: 'q', placeholder: 'Tìm theo tên' },
          { kind: 'select', field: 'isActive', placeholder: 'Trạng thái', options: ACTIVE_FILTER_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        {sortColumn<GroupScoringRuleRecord>(sorters, 'name', 'Tên')}
        {sortColumn<GroupScoringRuleRecord>(sorters, 'pointsWin', 'Điểm thắng / thua', (_, rule) => `${rule.pointsWin} / ${rule.pointsLoss}`)}
        <Table.Column<GroupScoringRuleRecord> key="unfinished" title="Trận dang dở" render={(_, rule) => unfinishedLabel(rule.unfinishedMatchScoring)} />
        {statusColumn<GroupScoringRuleRecord>((rule) =>
          rule.withdrawalPolicyMissing ? <Tag color="orange">Chưa chọn xử lý rút lui</Tag> : null,
        )}
        {actionsColumn<GroupScoringRuleRecord>((rule) => ({ resource: RESOURCE, name: rule.name, supportsDefault: true }))}
      </Table>
    </List>
  );
}
