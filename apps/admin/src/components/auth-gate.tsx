import { useQuery } from '@tanstack/react-query';
import { CatchAllNavigate } from '@refinedev/react-router';
import { Button, Result, Skeleton } from 'antd';
import { Outlet } from 'react-router';
import { loadCurrentUser } from '../providers/current-user';

/** Signed out (401) goes to /login; any other failure of /auth/me shows a retry screen instead of a false sign-out. */
export function AuthGate() {
  const me = useQuery({ queryKey: ['auth-gate'], queryFn: () => loadCurrentUser(), retry: false, gcTime: 0 });

  if (me.isPending) return <Skeleton active />;
  if (me.isError) {
    return (
      <Result
        status="error"
        title="Không kết nối được máy chủ"
        subTitle="Phiên đăng nhập của bạn vẫn còn. Thử lại sau giây lát."
        extra={<Button type="primary" loading={me.isFetching} onClick={() => void me.refetch()}>Thử lại</Button>}
      />
    );
  }
  return me.data ? <Outlet /> : <CatchAllNavigate to="/login" />;
}
