export interface MonthGroup<T> {
  /** YYYY-MM of the start date. */
  month: string;
  items: T[];
}

/**
 * Groups the items of one page by the month they start in, keeping the API order.
 * The month comes from the calendar string itself, so no time zone can move an event to another month.
 */
export function groupEventsByMonth<T extends { startDate: string }>(items: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const item of items) {
    const month = item.startDate.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}
