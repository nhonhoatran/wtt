import { useGetIdentity } from '@refinedev/core';
import { Card, Col, Empty, Row, theme, Typography } from 'antd';
import { Link } from 'react-router';
import { visibleMenuGroups } from '../layout/menu-groups';
import type { CurrentUser } from '../providers/current-user';

/** Shortcuts to what this role can open. Tournament and score-entry shortcuts arrive with phases 04–07. */
export function RoleHomePage() {
  const { data: user } = useGetIdentity<CurrentUser>();
  const { token } = theme.useToken();
  if (!user) return null;
  const items = visibleMenuGroups(user.role).flatMap((group) => group.items.filter((item) => !item.external));

  return (
    <>
      <Typography.Title level={3}>Xin chào, {user.name}</Typography.Title>
      {items.length === 0 ? (
        <Empty description="Chưa có màn nào mở cho vai trò của bạn ở phiên bản này." />
      ) : (
        <Row gutter={[token.margin, token.margin]}>
          {items.map((item) => (
            <Col key={item.key} xs={24} sm={12} lg={8}>
              <Link to={item.path}>
                <Card hoverable>
                  <Typography.Text strong>{item.label}</Typography.Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
