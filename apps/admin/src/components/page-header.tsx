import { Flex, theme, Typography } from 'antd';
import type { ReactNode } from 'react';
import { BackLink } from './back-link';

interface PageHeaderProps {
  title: ReactNode;
  /** Link back to the parent list; renders the shared back link above the title. */
  back?: { to: string; label: ReactNode };
  tags?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions; wraps below the title on narrow screens. */
  actions?: ReactNode;
}

export function PageHeader({ title, back, tags, subtitle, actions }: PageHeaderProps) {
  const { token } = theme.useToken();
  return (
    <Flex justify="space-between" align="flex-start" wrap gap={token.margin} style={{ marginBottom: token.marginLG }}>
      <Flex vertical gap={token.marginXXS} style={{ minWidth: 0 }}>
        {back && <BackLink to={back.to}>{back.label}</BackLink>}
        <Flex align="center" wrap gap={token.marginXS}>
          <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
          {tags}
        </Flex>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </Flex>
      {actions && <Flex wrap gap={token.marginXS}>{actions}</Flex>}
    </Flex>
  );
}
