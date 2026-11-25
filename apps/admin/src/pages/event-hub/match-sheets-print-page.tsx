import { PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Flex, Result, Select, Skeleton, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { roundTitle } from './draw-labels';
import { DAY_QUERY_PARAM, SESSION_QUERY_PARAM } from './entry-labels';
import styles from './match-sheets-print.module.css';
import { sessionsKey, tableLabel, timeInZone, type SessionRecord } from './schedule-types';
import { TruncatedNotice } from './truncated-notice';
import { BackLink } from '../../components/back-link';

// Shared by the @page rule (which cannot read custom properties of a page element) and the sheet height math in the stylesheet.
const SHEET_PAGE_MARGIN = '10mm';
const PAGE_RULE = `@page { size: A4 portrait; margin: ${SHEET_PAGE_MARGIN}; }`;

interface SheetSide {
  name: string;
  club: string;
}

interface Sheet {
  matchId: string;
  matchNo: number;
  sessionCode: string;
  tableCode: string | null;
  tableName: string | null;
  scheduledAt: string | null;
  subEventCode: string;
  subEventName: string | null;
  roundCode: string;
  groupCode: string | null;
  bestOf: number;
  pointsPerGame: number;
  winBy: number;
  side1: SheetSide;
  side2: SheetSide;
}

interface SheetsResponse {
  data: { event: { timezone: string }; sheets: Sheet[]; truncated: boolean };
}

const sideCell = (side: SheetSide) => (
  <>
    <strong>{side.name}</strong>
    {side.club && <div>{side.club}</div>}
  </>
);

function MatchSheet({ sheet, timeZone }: { sheet: Sheet; timeZone: string }) {
  return (
    <section className={styles.matchSheet}>
      <h2>
        Trận #{sheet.matchNo} · {sheet.subEventCode} – {roundTitle(sheet.roundCode)}
        {sheet.groupCode ? ` · Bảng ${sheet.groupCode}` : ''}
      </h2>
      <dl>
        <dt>Bàn</dt>
        <dd>{sheet.tableName ?? sheet.tableCode ?? '—'}</dd>
        <dt>Giờ</dt>
        <dd>{sheet.scheduledAt ? timeInZone(sheet.scheduledAt, timeZone) : '—'}</dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th scope="col">Ván</th>
            <th scope="col">{sideCell(sheet.side1)}</th>
            <th scope="col">{sideCell(sheet.side2)}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: sheet.bestOf }, (_, index) => (
            <tr key={index}>
              <th scope="row">Ván {index + 1}</th>
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.sheetNote}>
        Thắng ván khi đạt {sheet.pointsPerGame} điểm, hơn đối thủ {sheet.winBy} điểm.
      </p>
      <div className={styles.sheetSignature}>Chữ ký trọng tài: ______________________</div>
    </section>
  );
}

/** Printable match sheets (2 per A4) of one session, optionally one table; reached from the schedule tab. */
export function MatchSheetsPrintPage() {
  const { id = '' } = useParams();
  const { token } = theme.useToken();
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('sessionId') ?? '';
  const tableId = params.get('tableId') ?? undefined;

  const sessions = useQuery({
    queryKey: sessionsKey(id),
    queryFn: async () => (await apiFetch<{ data: SessionRecord[] }>(`/admin/events/${id}/sessions`)).data,
  });
  const sheets = useQuery({
    queryKey: ['admin-match-sheets', id, sessionId, tableId],
    enabled: Boolean(sessionId),
    queryFn: async () => (await apiFetch<SheetsResponse>(`/admin/events/${id}/match-sheets?${new URLSearchParams({ sessionId, ...(tableId && { tableId }) })}`)).data,
  });

  const session = sessions.data?.find((item) => item.id === sessionId);
  const backTo = `/events/${id}/schedule?${new URLSearchParams({ [DAY_QUERY_PARAM]: session?.date ?? '', [SESSION_QUERY_PARAM]: sessionId })}`;
  const title = session ? `Phiếu trận — ${session.code} · ${dayjs(session.date).format(DISPLAY_DATE_FORMAT)}` : 'Phiếu trận';

  const pickTable = (value: string | undefined) =>
    setParams((current) => {
      if (value) current.set('tableId', value);
      else current.delete('tableId');
      return current;
    });

  let content;
  if (!sessionId) content = <Result status="warning" title="Chưa chọn buổi để in" />;
  else if (sheets.isLoading || sessions.isLoading) content = <Skeleton active />;
  else if (sheets.isError || !sheets.data) {
    content = <Result status="error" title="Không tải được phiếu trận" extra={<Button onClick={() => sheets.refetch()}>Thử lại</Button>} />;
  } else if (sheets.data.sheets.length === 0) content = <Empty description="Buổi này chưa có trận" />;
  else {
    content = (
      <div className={styles.matchSheets}>
        {sheets.data.sheets.map((sheet) => (
          <MatchSheet key={sheet.matchId} sheet={sheet} timeZone={sheets.data!.event.timezone} />
        ))}
      </div>
    );
  }

  return (
    <Flex className={styles.printPage} style={{ padding: token.paddingLG, '--sheet-page-margin': SHEET_PAGE_MARGIN } as React.CSSProperties} vertical gap="middle">
      <style>{PAGE_RULE}</style>
      <Flex className={styles.noPrint} vertical gap="middle">
        <BackLink to={backTo}>Về lịch & kết quả</BackLink>
        <Flex justify="space-between" align="center" wrap gap="small">
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Flex gap="small" wrap>
            <Select
              aria-label="Bàn"
              allowClear
              placeholder="Tất cả bàn"
              value={tableId}
              options={(session?.tables ?? []).map((table) => ({ value: table.tableId, label: tableLabel(table) }))}
              onChange={pickTable}
            />
            <Button type="primary" icon={<PrinterOutlined />} disabled={!sheets.data?.sheets.length} onClick={() => window.print()}>
              In
            </Button>
          </Flex>
        </Flex>
        {sessions.isError && (
          <Alert type="error" showIcon message="Không tải được danh sách buổi thi đấu" action={<Button size="small" onClick={() => sessions.refetch()}>Thử lại</Button>} />
        )}
        {sheets.data?.truncated && <TruncatedNotice action="in" shown={sheets.data.sheets.length} />}
      </Flex>
      {content}
    </Flex>
  );
}
