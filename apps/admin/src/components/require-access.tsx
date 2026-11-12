import { CanAccess } from '@refinedev/core';
import { Button, Result } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Typing the URL of a page the role cannot use shows this instead; the API refuses it anyway. */
export function RequireAccess({ resource, action, children }: { resource: string; action: string; children: ReactNode }) {
  return (
    <CanAccess
      resource={resource}
      action={action}
      fallback={
        <Result
          status="403"
          title="Bạn không có quyền vào màn này"
          extra={
            <Link to="/">
              <Button type="primary">Về trang chủ</Button>
            </Link>
          }
        />
      }
    >
      {children}
    </CanAccess>
  );
}
