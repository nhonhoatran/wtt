import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Flex, Select, Typography, theme } from 'antd';

export interface SortableOption<T extends string> {
  value: T;
  label: string;
}

export interface SortableListFieldProps<T extends string> {
  value?: T[];
  onChange?: (value: T[]) => void;
  /** Full vocabulary; items not yet in `value` can be added from the select. */
  options: SortableOption<T>[];
  /** Singular noun used in button labels, e.g. "tiêu chí" or "bàn". */
  noun: string;
  addPlaceholder: string;
}

interface RowProps {
  id: string;
  label: string;
  noun: string;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

function SortableRow({ id, label, noun, index, total, onMove, onRemove }: RowProps) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

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
      <Button type="text" size="small" icon={<CloseOutlined />} onClick={onRemove} aria-label={`Bỏ ${noun}: ${label}`} />
    </Flex>
  );
}

/** Ordered list: drag, use the arrow buttons, or add/remove items from a fixed vocabulary. */
export function SortableListField<T extends string>({ value = [], onChange, options, noun, addPlaceholder }: SortableListFieldProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const remaining = options.filter((option) => !value.includes(option.value));
  const labelOf = (item: T) => options.find((option) => option.value === item)?.label ?? item;

  const move = (from: number, to: number) => onChange?.(arrayMove(value, from, to));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(value.indexOf(active.id as T), value.indexOf(over.id as T));
  };

  return (
    <Flex vertical gap="small">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value} strategy={verticalListSortingStrategy}>
          {value.map((item, index) => (
            <SortableRow
              key={item}
              id={item}
              label={labelOf(item)}
              noun={noun}
              index={index}
              total={value.length}
              onMove={move}
              onRemove={() => onChange?.(value.filter((other) => other !== item))}
            />
          ))}
        </SortableContext>
      </DndContext>
      {remaining.length > 0 && <Select<T> value={null as never} placeholder={addPlaceholder} options={remaining} onChange={(item) => onChange?.([...value, item])} />}
    </Flex>
  );
}
