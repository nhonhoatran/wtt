import type { ComponentType, ReactNode } from 'react';
import { Route } from 'react-router';
import { RequireAccess } from '../components/require-access';
import { CategoryCreate, CategoryEdit } from './categories/category-form';
import { CategoryList } from './categories/category-list';
import { DisciplineCreate, DisciplineEdit } from './disciplines/discipline-form';
import { DisciplineList } from './disciplines/discipline-list';
import { EventTypeCreate, EventTypeEdit } from './event-types/event-type-form';
import { EventTypeList } from './event-types/event-type-list';
import { GroupScoringRuleCreate, GroupScoringRuleEdit } from './group-scoring-rules/group-scoring-rule-form';
import { GroupScoringRuleList } from './group-scoring-rules/group-scoring-rule-list';
import { MatchFormatCreate, MatchFormatEdit } from './match-formats/match-format-form';
import { MatchFormatList } from './match-formats/match-format-list';
import { TierCreate, TierEdit } from './tiers/tier-form';
import { TierList } from './tiers/tier-list';
import { VenueCreate, VenueEdit } from './venues/venue-form';
import { VenueList } from './venues/venue-list';

interface CatalogPages {
  name: string;
  label: string;
  List: ComponentType;
  Create: ComponentType;
  Edit: ComponentType;
}

const CATALOGS: CatalogPages[] = [
  { name: 'tiers', label: 'Nhóm giải', List: TierList, Create: TierCreate, Edit: TierEdit },
  { name: 'event-types', label: 'Hạng giải', List: EventTypeList, Create: EventTypeCreate, Edit: EventTypeEdit },
  { name: 'disciplines', label: 'Nội dung chuẩn', List: DisciplineList, Create: DisciplineCreate, Edit: DisciplineEdit },
  { name: 'categories', label: 'Nhóm tuổi / trình độ', List: CategoryList, Create: CategoryCreate, Edit: CategoryEdit },
  { name: 'match-formats', label: 'Thể thức trận', List: MatchFormatList, Create: MatchFormatCreate, Edit: MatchFormatEdit },
  { name: 'group-scoring-rules', label: 'Luật vòng bảng', List: GroupScoringRuleList, Create: GroupScoringRuleCreate, Edit: GroupScoringRuleEdit },
  { name: 'venues', label: 'Địa điểm & bàn', List: VenueList, Create: VenueCreate, Edit: VenueEdit },
];

export const catalogResources = CATALOGS.map(({ name, label }) => ({
  name,
  list: `/${name}`,
  create: `/${name}/create`,
  edit: `/${name}/:id/edit`,
  meta: { label },
}));

const guarded = (action: string, element: ReactNode) => (
  <RequireAccess resource="tournaments" action={action}>
    {element}
  </RequireAccess>
);

/** Rendered inside <Routes>; a plain fragment of <Route> elements, not a component. */
export const catalogRoutes = CATALOGS.map(({ name, List, Create, Edit }) => (
  <Route key={name}>
    <Route path={`/${name}`} element={guarded('list', <List />)} />
    <Route path={`/${name}/create`} element={guarded('create', <Create />)} />
    <Route path={`/${name}/:id/edit`} element={guarded('edit', <Edit />)} />
  </Route>
));
