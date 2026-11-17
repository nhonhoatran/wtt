# Phase 09 UI agent 3 - tasks 7-8 (ranking list on sub-events, seed suggestion)

Status: DONE_WITH_CONCERNS. Typecheck api pass; admin only fails in other agents' pages/ranking/*; lint admin pass.

## API
sub-event-items.ts SUB_EVENT_INCLUDE: + rankingList {id, code, name}; + discipline competitorKind, genderRule (EntrySubEvent type already assumed them but the API never returned them).

## Admin (apps/admin/src/pages/event-hub)
- NEW use-ranking-list-options.ts, sub-event-ranking-field.tsx, draw-seed-suggestion-modal.tsx
- sub-event-edit-modal.tsx (PATCH sends rankingListId ?? null so clearing works), bulk-sub-event-modal.tsx, sub-events-tab.tsx (column "Bảng XH"), sub-event-labels.ts, draw-seeds-step.tsx
- draw-wizard.tsx untouched (subEvent already carries rankingList).

## Decisions
- Button-disabled detection: suggest-seeds even with apply:false writes (audit row + rankingAtEntry/points), so no call on mount. Disabled only when subEvent.rankingList is null (tooltip). "Bảng chưa có kỳ chốt công bố" shown as info Alert inside the modal after 1 click.
- Ranking list select: own hook (filter[competitorKind] not supported by useCatalogSelect, categoryId needed client-side for default match); loads all pages, search is client-side on a small catalog.
- Default fill: exactly 1 list per target matching genderRule+categoryId; bulk fills only if all items resolve to the same list; never overwrites a pick; clears a pick that no longer fits after kind changes.
- Apply button disabled when no entry gets a seed.

## Invented copy to review
"Bảng chưa có kỳ chốt công bố" (Alert), "Ghi đè", "Không xem trước được gợi ý", "Không áp dụng được, thử lại", "Bảng XH".

## Not verified
No browser run; e2e not run.
