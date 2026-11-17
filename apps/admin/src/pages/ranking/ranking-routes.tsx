import type { ReactNode } from 'react';
import { Route } from 'react-router';
import { RequireAccess } from '../../components/require-access';
import { RankingListCreate, RankingListEdit } from '../../resources/ranking-lists/ranking-list-form';
import { RankingListList } from '../../resources/ranking-lists/ranking-list-list';
import { RankingPointsPage } from './ranking-points-page';
import { RankingRulesMatrixPage } from './ranking-rules-matrix-page';
import { RankingSnapshotsPage } from './ranking-snapshots-page';
import { SnapshotPreviewPage } from './snapshot-preview-page';

const guarded = (action: string, element: ReactNode) => (
  <RequireAccess resource="rankings" action={action}>
    {element}
  </RequireAccess>
);

/** Rendered inside <Routes>; a plain fragment of <Route> elements, not a component. */
export const rankingRoutes = (
  <Route>
    <Route path="/ranking-lists" element={guarded('list', <RankingListList />)} />
    <Route path="/ranking-lists/create" element={guarded('create', <RankingListCreate />)} />
    <Route path="/ranking-lists/:id/edit" element={guarded('edit', <RankingListEdit />)} />
    <Route path="/ranking-rules" element={guarded('list', <RankingRulesMatrixPage />)} />
    <Route path="/ranking-points" element={guarded('list', <RankingPointsPage />)} />
    <Route path="/ranking-snapshots" element={guarded('list', <RankingSnapshotsPage />)} />
    <Route path="/ranking-snapshots/:id" element={guarded('show', <SnapshotPreviewPage />)} />
  </Route>
);

export const rankingResources = [
  { name: 'ranking-lists', list: '/ranking-lists', create: '/ranking-lists/create', edit: '/ranking-lists/:id/edit', meta: { label: 'Bảng xếp hạng' } },
  { name: 'ranking-points', list: '/ranking-points', meta: { label: 'Sổ điểm' } },
  { name: 'ranking-snapshots', list: '/ranking-snapshots', show: '/ranking-snapshots/:id', meta: { label: 'Kỳ chốt' } },
];
