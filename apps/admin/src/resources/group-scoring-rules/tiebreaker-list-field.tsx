import { TIEBREAK_CRITERIA, TIEBREAK_CRITERION_LABELS, type TiebreakCriterion } from '@kamito/shared';
import { SortableListField } from '../../components/sortable-list-field';

interface TiebreakerListFieldProps {
  value?: TiebreakCriterion[];
  onChange?: (value: TiebreakCriterion[]) => void;
}

const CRITERION_OPTIONS = TIEBREAK_CRITERIA.map((criterion) => ({ value: criterion, label: TIEBREAK_CRITERION_LABELS[criterion] }));

/** Ordered tiebreak criteria from the fixed vocabulary. */
export function TiebreakerListField({ value, onChange }: TiebreakerListFieldProps) {
  return <SortableListField value={value} onChange={onChange} options={CRITERION_OPTIONS} noun="tiêu chí" addPlaceholder="Thêm tiêu chí xếp hạng" />;
}
