import { CloseOutlined, ArrowDownOutlined, ArrowUpOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TIEBREAK_CRITERIA, TIEBREAK_CRITERION_LABELS, type TiebreakCriterion } from '@kamito/shared';
import { Button, Flex, Select, Typography, theme } from 'antd';

interface TiebreakerListFieldProps {
  value?: TiebreakCriterion[];
  onChange?: (value: TiebreakCriterion[]) => void;
}

interface RowProps {
  criterion: TiebreakCriterion;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

function TiebreakerRow({ criterion, index, total, onMove, onRemove }: RowProps) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: criterion });
  const label = TIEBREAK_CRITERION_LABELS[criterion];

  return (
    <Flex
      ref={setNodeRef}
      align="center"
      gap="small"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        padding: token.paddingXS,
        border: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        background: isDragging ? token.colorFillTertiary : token.colorBgContainer,
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<HolderOutlined />}
        ref={setActivatorNodeRef}
        aria-label={`Kéo để đổi thứ tự: ${label}`}
        style={{ cursor: 'grab', touchAction: 'none' }}
        {...attributes}
        {...listeners}
      />
      <Typography.Text type="secondary">{index + 1}.</Typography.Text>
      <Typography.Text style={{ flex: 1 }}>{label}</Typography.Text>
      <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Đưa lên: ${label}`} />
      <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Đưa xuống: ${label}`} />
      <Button type="text" size="small" icon={<CloseOutlined />} onClick={onRemove} aria-label={`Bỏ tiêu chí: ${label}`} />
    </Flex>
  );
}

/** Ordered tiebreak criteria: drag, use the arrow buttons, or add/remove from the fixed vocabulary. */
export function TiebreakerListField({ value = [], onChange }: TiebreakerListFieldProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const remaining = TIEBREAK_CRITERIA.filter((criterion) => !value.includes(criterion));

  const move = (from: number, to: number) => onChange?.(arrayMove(value, from, to));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(value.indexOf(active.id as TiebreakCriterion), value.indexOf(over.id as TiebreakCriterion));
  };

  return (
    <Flex vertical gap="small">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value} strategy={verticalListSortingStrategy}>
          {value.map((criterion, index) => (
            <TiebreakerRow
              key={criterion}
              criterion={criterion}
              index={index}
              total={value.length}
              onMove={move}
              onRemove={() => onChange?.(value.filter((item) => item !== criterion))}
            />
          ))}
        </SortableContext>
      </DndContext>
      {remaining.length > 0 && (
        <Select<TiebreakCriterion>
          value={null as never}
          placeholder="Thêm tiêu chí xếp hạng"
          options={remaining.map((criterion) => ({ value: criterion, label: TIEBREAK_CRITERION_LABELS[criterion] }))}
          onChange={(criterion) => onChange?.([...value, criterion])}
        />
      )}
    </Flex>
  );
}
