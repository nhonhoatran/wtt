import { Button, Flex, theme, Typography } from 'antd';

interface RankingRulesUnsavedBarProps {
  changed: number;
  invalid: number;
  disabled: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/** Sticks to the bottom of the scroll area while there are unsaved edits. */
export function RankingRulesUnsavedBar({ changed, invalid, disabled, onDiscard, onSave }: RankingRulesUnsavedBarProps) {
  const { token } = theme.useToken();
  return (
    <Flex
      role="region"
      aria-label="Thay đổi chưa lưu"
      wrap
      align="center"
      justify="space-between"
      gap={token.margin}
      style={{
        position: 'sticky',
        bottom: token.margin,
        zIndex: 10,
        marginTop: token.marginLG,
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <Flex align="center" wrap gap={token.marginXS}>
        <span aria-hidden style={{ width: token.sizeXS, height: token.sizeXS, borderRadius: '50%', background: token.colorWarning }} />
        <Typography.Text strong>{changed} thay đổi chưa lưu</Typography.Text>
        {invalid > 0 && <Typography.Text type="danger">· {invalid} ô cần sửa</Typography.Text>}
      </Flex>
      <Flex gap={token.marginXS}>
        <Button onClick={onDiscard}>Huỷ thay đổi</Button>
        <Button type="primary" disabled={disabled || invalid > 0} onClick={onSave}>Lưu thay đổi</Button>
      </Flex>
    </Flex>
  );
}
