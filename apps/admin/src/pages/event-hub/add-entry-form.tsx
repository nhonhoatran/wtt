import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Radio, Select, Typography, type RefSelectProps } from 'antd';
import { useRef, useState } from 'react';
import { PlayerLookupSelect } from '../../components/player-lookup-select';
import { GENDER_OPTIONS, type Gender, type PlayerLookupItem } from '../../resources/players/player-labels';
import { AddEntryFeedbackText } from './add-entry-feedback';
import { ENTRY_STAGE_OPTIONS, genderForRule, isDoubles, type EntryStage, type EntrySubEvent } from './entry-labels';
import { useAddEntry } from './use-add-entry';

const LOOKUP_WIDTH = 340;

type Slots = [PlayerLookupItem | null, PlayerLookupItem | null];

interface AddEntryFormProps {
  subEvent: EntrySubEvent;
  canOverride: boolean;
  onAdded: () => Promise<unknown>;
}

/** Keyboard-first: type a name, Enter picks, Enter again adds, and focus returns to the lookup for the next person. */
export function AddEntryForm({ subEvent, canOverride, onAdded }: AddEntryFormProps) {
  const doubles = isDoubles(subEvent);
  const gender = genderForRule(subEvent.discipline.genderRule);
  const [slots, setSlots] = useState<Slots>([null, null]);
  const [stage, setStage] = useState<EntryStage>('MAIN');
  const [pendingNew, setPendingNew] = useState<{ name: string; slot: 0 | 1 } | null>(null);
  const refs = [useRef<RefSelectProps>(null), useRef<RefSelectProps>(null)] as const;
  const { add, addWithReason, createPlayer, feedback, clearFeedback, saving } = useAddEntry(subEvent.id, onAdded);

  const focus = (slot: 0 | 1) => setTimeout(() => refs[slot].current?.focus());
  const setSlot = (slot: 0 | 1, player: PlayerLookupItem | null) => {
    clearFeedback();
    setSlots((current) => (slot === 0 ? [player, current[1]] : [current[0], player]));
  };

  const afterAdd = (added: boolean) => {
    if (added) {
      setSlots([null, null]);
      focus(0);
    }
    return added;
  };

  const submit = async (picked: Slots = slots) => {
    const ids = (doubles ? picked : [picked[0]]).map((player) => player?.id);
    if (ids.some((id) => !id)) return;
    afterAdd(await add(ids as string[], stage));
  };

  const createAndUse = async (name: string, slot: 0 | 1, playerGender: Gender) => {
    setPendingNew(null);
    const player = await createPlayer(name, playerGender);
    if (!player) return;
    const next: Slots = slot === 0 ? [player, slots[1]] : [slots[0], player];
    setSlots(next);
    if (!doubles) await submit(next);
    else if (!next[0] || !next[1]) focus(next[0] ? 1 : 0);
    else focus(slot);
  };

  const onCreateNew = (slot: 0 | 1) => (name: string) => {
    if (gender) void createAndUse(name, slot, gender);
    else setPendingNew({ name, slot });
  };

  const lookup = (slot: 0 | 1) => (
    <PlayerLookupSelect
      selectRef={refs[slot]}
      autoFocus={slot === 0}
      value={slots[slot]}
      onChange={(player) => {
        setSlot(slot, player);
        if (player && doubles && slot === 0 && !slots[1]) focus(1);
      }}
      onEnter={() => (doubles && slot === 0 && !slots[1] ? focus(1) : void submit())}
      gender={gender}
      excludeIds={slots.flatMap((player, index) => (player && index !== slot ? [player.id] : []))}
      onCreateNew={onCreateNew(slot)}
      placeholder={doubles ? `VĐV ${slot + 1}: gõ tên hoặc mã` : 'Gõ tên hoặc mã VĐV rồi Enter'}
      aria-label={doubles ? `VĐV ${slot + 1}` : 'Thêm VĐV'}
      status={feedback ? 'error' : undefined}
      style={{ width: LOOKUP_WIDTH }}
    />
  );

  const ready = doubles ? Boolean(slots[0] && slots[1]) : Boolean(slots[0]);

  return (
    <Flex vertical gap="small">
      <Flex gap="small" wrap align="center">
        {lookup(0)}
        {doubles && lookup(1)}
        {subEvent.hasQualifying && (
          <Select value={stage} onChange={setStage} options={ENTRY_STAGE_OPTIONS} aria-label="Vòng" style={{ minWidth: 130 }} />
        )}
        <Button type="primary" icon={<PlusOutlined />} disabled={!ready} loading={saving} onClick={() => void submit()}>
          {doubles ? 'Thêm cặp' : 'Thêm vào danh sách'}
        </Button>
      </Flex>
      {pendingNew && (
        <Flex gap="small" align="center" wrap>
          <Typography.Text>Giới tính của "{pendingNew.name}":</Typography.Text>
          <Radio.Group
            optionType="button"
            options={GENDER_OPTIONS}
            onChange={(event) => void createAndUse(pendingNew.name, pendingNew.slot, event.target.value as Gender)}
          />
          <Button type="link" onClick={() => setPendingNew(null)}>
            Hủy
          </Button>
        </Flex>
      )}
      {feedback && <AddEntryFeedbackText feedback={feedback} canOverride={canOverride} saving={saving} onOverride={async (reason) => afterAdd(await addWithReason(reason))} />}
    </Flex>
  );
}
