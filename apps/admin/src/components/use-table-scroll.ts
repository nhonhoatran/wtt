import { Grid, type TableProps } from 'antd';

/** Phones keep each column at its natural width and scroll sideways instead of breaking words; wider screens fit and wrap. */
export function useTableScroll(): TableProps['scroll'] {
  return Grid.useBreakpoint().md === false ? { x: 'max-content' } : { x: true };
}
