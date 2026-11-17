import { Button, Flex, Form, Select, Typography, type FormInstance } from 'antd';
import { useEffect } from 'react';
import { suggestRankingListId, useRankingListOptions, type RankingListTarget } from './use-ranking-list-options';

interface SubEventRankingFieldProps {
  form: FormInstance;
  targets: RankingListTarget[];
  /** Currently saved list; kept as an option even if it was hidden since, so the label still shows. */
  current?: { id: string; name: string } | null;
  /** Create flow fills the single match; the edit flow only offers it as a hint so an empty choice stays empty. */
  autoFill?: boolean;
}

/** Ranking list picker limited to the singles/doubles kind of the target sub-events; pre-fills a single obvious match. */
export function SubEventRankingField({ form, targets, current, autoFill = false }: SubEventRankingFieldProps) {
  const kinds = [...new Set(targets.map((target) => target.kind))];
  const kind = kinds.length === 1 ? kinds[0]! : null;
  const lists = useRankingListOptions(kind);
  // Placeholder rows belong to the previous kind while the new kind loads.
  const rows = lists.isPlaceholderData ? undefined : lists.data;
  const targetsKey = JSON.stringify(targets);

  useEffect(() => {
    if (!rows) return;
    const picked = form.getFieldValue('rankingListId') as string | undefined;
    if (picked && (rows.some((row) => row.id === picked) || picked === current?.id)) return;
    if (picked) form.setFieldValue('rankingListId', undefined);
    if (!autoFill) return;
    const suggested = suggestRankingListId(rows, JSON.parse(targetsKey) as RankingListTarget[]);
    if (suggested) form.setFieldValue('rankingListId', suggested);
  }, [form, rows, targetsKey, current?.id, autoFill]);
  const picked = Form.useWatch('rankingListId', form) as string | undefined;
  const suggestedId = !autoFill && !picked && rows ? suggestRankingListId(rows, targets) : null;
  const suggestedName = rows?.find((row) => row.id === suggestedId)?.name;

  if (targets.length === 0) return null;
  if (!kind) {
    return (
      <Typography.Text type="secondary">Chọn bảng xếp hạng riêng cho từng nội dung sau khi tạo</Typography.Text>
    );
  }

  const options = (rows ?? []).map((row) => ({ value: row.id, label: row.name }));
  if (current && !options.some((option) => option.value === current.id)) options.unshift({ value: current.id, label: current.name });

  const hint = suggestedId && (
    <Flex align="center" gap="small">
      <Typography.Text type="secondary">Gợi ý: {suggestedName}</Typography.Text>
      <Button type="link" size="small" onClick={() => form.setFieldValue('rankingListId', suggestedId)}>
        Dùng
      </Button>
    </Flex>
  );

  return (
    <Form.Item
      name="rankingListId"
      label="Bảng xếp hạng"
      extra={
        <>
          Để trống thì nội dung không tính điểm xếp hạng.
          {hint}
        </>
      }
    >
      <Select allowClear showSearch optionFilterProp="label" options={options} loading={lists.isFetching} />
    </Form.Item>
  );
}
