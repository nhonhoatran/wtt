export interface BreadcrumbItemSource {
  label: string;
  path: string;
  external?: boolean;
}

export interface BreadcrumbGroupSource {
  label: string;
  items: BreadcrumbItemSource[];
}

export interface BreadcrumbEntry {
  title: string;
  path?: string;
}

export interface BreadcrumbOptions {
  /** Last crumb set by a detail page, e.g. the tournament name. */
  tail?: string;
  /** Label for `/` (the landing page differs per role). */
  homeTitle: string;
  rootTitle: string;
  actionTitles: Record<string, string>;
}

const matchesPath = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

/** Longest matching menu path wins, so `/ranking-lists` never resolves to a shorter prefix. */
export function findMenuEntry<G extends BreadcrumbGroupSource>(pathname: string, groups: G[]) {
  let best: { group: G; item: G['items'][number] } | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.external || !matchesPath(pathname, item.path)) continue;
      if (!best || item.path.length > best.item.path.length) best = { group, item };
    }
  }
  return best;
}

export function buildBreadcrumb(pathname: string, groups: BreadcrumbGroupSource[], options: BreadcrumbOptions): BreadcrumbEntry[] {
  const root: BreadcrumbEntry = { title: options.rootTitle, path: '/' };
  if (pathname === '/') return [root, { title: options.homeTitle }];

  const match = findMenuEntry(pathname, groups);
  if (!match) return [root];

  const rest = pathname.slice(match.item.path.length).split('/').filter(Boolean);
  const action = rest.map((segment) => options.actionTitles[segment]).find(Boolean);
  const tail = options.tail ?? action;
  const crumbs: BreadcrumbEntry[] = [root];
  if (match.group.label !== match.item.label) crumbs.push({ title: match.group.label });
  crumbs.push(tail || rest.length > 0 ? { title: match.item.label, path: match.item.path } : { title: match.item.label });
  if (tail) crumbs.push({ title: tail });
  return crumbs;
}
