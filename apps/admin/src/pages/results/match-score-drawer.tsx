import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Flex, Result, Skeleton, Typography } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '../../api/http-client';
import { useConfirmAction } from '../../components/confirm-action-button';
import { MatchDrawerBody } from './match-drawer-body';
import type { MatchNavigation } from './match-navigation';
import { matchDetailKey, type MatchDetail } from './match-types';

/** Wide enough for the grid beside the list on a desktop, full screen on a phone. */
const DRAWER_WIDTH = 'min(720px, 100vw)';

interface MatchScoreDrawerProps {
  matchId: string | null;
  eventId: string;
  timeZone: string;
  navigation: (MatchNavigation & { scope: string }) | null;
  onNavigate: (direction: 'prev' | 'next') => void;
  onClose: () => void;
  onForeignMatch: () => void;
  onStarted: () => void;
  onConfirmed: (finishedTableId: string | null) => void;
  onReload: () => void;
}

export function MatchScoreDrawer({ matchId, eventId, timeZone, navigation, onNavigate, onClose, onForeignMatch, onStarted, onConfirmed, onReload }: MatchScoreDrawerProps) {
  const confirmAction = useConfirmAction();
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const detail = useQuery({
    queryKey: matchDetailKey(matchId),
    enabled: matchId !== null,
    queryFn: async () => (await apiFetch<{ data: MatchDetail }>(`/admin/matches/${encodeURIComponent(matchId ?? '')}`)).data,
  });
  const match = detail.data;
  const foreign = match !== undefined && match.eventId !== eventId;
  const foreignRef = useRef(onForeignMatch);
  foreignRef.current = onForeignMatch;
  useEffect(() => {
    if (foreign) foreignRef.current();
  }, [foreign, match?.id]);

  const reload = async () => {
    onReload();
    return (await detail.refetch()).data;
  };

  const guarded = (okText: string, proceed: () => void) => {
    if (!dirty.current) return proceed();
    confirmAction({
      title: 'Bỏ tỷ số đang nhập?',
      content: 'Tỷ số vừa nhập chưa được lưu và sẽ mất. Bấm "Lưu nháp" trước nếu muốn giữ lại.',
      okText,
      danger: true,
      onConfirm: async () => proceed(),
    });
  };
  const go = (direction: 'prev' | 'next') => guarded('Bỏ và chuyển trận', () => onNavigate(direction));
  const close = () => guarded('Bỏ và đóng', onClose);

  const title = navigation ? (
    <Flex wrap align="center" gap="small">
      <Typography.Text strong>{`Trận ${navigation.position}/${navigation.total} ${navigation.scope}`}</Typography.Text>
      <Button size="small" icon={<LeftOutlined />} disabled={!navigation.prev} onClick={() => go('prev')}>
        Trận trước
      </Button>
      <Button size="small" disabled={!navigation.next} onClick={() => go('next')}>
        Trận sau <RightOutlined />
      </Button>
    </Flex>
  ) : (
    'Nhập tỷ số'
  );

  return (
    <Drawer open={matchId !== null} onClose={close} width={DRAWER_WIDTH} title={title} styles={{ body: { padding: 0 } }} destroyOnHidden>
      {detail.isError && <Result status="error" title="Không tải được trận" extra={<Button onClick={() => void reload()}>Tải lại</Button>} />}
      {detail.isLoading && <Skeleton active style={{ padding: 24 }} />}
      {match && !foreign && <MatchDrawerBody key={match.id} detail={match} timeZone={timeZone} onDirtyChange={setDirty} onStarted={onStarted} onConfirmed={onConfirmed} onReload={reload} />}
    </Drawer>
  );
}
