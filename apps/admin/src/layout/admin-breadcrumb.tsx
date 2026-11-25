import { Breadcrumb } from 'antd';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { buildBreadcrumb } from './build-breadcrumb';
import { SHELL_LABELS, type MenuGroupDef } from './menu-groups';

interface BreadcrumbTailState {
  tail: string | undefined;
  setTail: (label: string | undefined) => void;
}

const BreadcrumbTailContext = createContext<BreadcrumbTailState>({ tail: undefined, setTail: () => undefined });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [tail, setTail] = useState<string>();
  const value = useMemo(() => ({ tail, setTail }), [tail]);
  return <BreadcrumbTailContext.Provider value={value}>{children}</BreadcrumbTailContext.Provider>;
}

/** Detail pages call this with their record name (tournament, snapshot period...); cleared on unmount. */
export function useBreadcrumbTail(label: string | undefined) {
  const { setTail } = useContext(BreadcrumbTailContext);
  useEffect(() => {
    setTail(label);
    return () => setTail(undefined);
  }, [label, setTail]);
}

export function AdminBreadcrumb({ groups, homeTitle }: { groups: MenuGroupDef[]; homeTitle: string }) {
  const { pathname } = useLocation();
  const { tail } = useContext(BreadcrumbTailContext);
  const crumbs = buildBreadcrumb(pathname, groups, {
    tail,
    homeTitle,
    rootTitle: SHELL_LABELS.root,
    actionTitles: SHELL_LABELS.actions,
  });
  const items = crumbs.map((crumb, index) => ({
    title: crumb.path && index < crumbs.length - 1 ? <Link to={crumb.path}>{crumb.title}</Link> : crumb.title,
  }));
  return <Breadcrumb items={items} style={{ minWidth: 0 }} />;
}
