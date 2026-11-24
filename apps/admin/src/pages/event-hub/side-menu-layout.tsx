import { Flex, Grid } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { SIDE_MENU_WIDTH } from './entry-labels';

/** Long sub-event lists scroll inside the stacked menu so the content below stays reachable on phones. */
const STACKED_SIDE_STYLE: CSSProperties = { maxHeight: '40vh', overflowY: 'auto' };

interface SideMenuLayoutProps {
  side: ReactNode;
  sideStyle?: CSSProperties;
  stackedSideStyle?: CSSProperties;
  children: ReactNode;
}

/** Side panel beside the content from tablets up; stacked above it on phones so the content keeps the full width. */
export function SideMenuLayout({ side, sideStyle, stackedSideStyle, children }: SideMenuLayoutProps) {
  const stacked = !Grid.useBreakpoint().md;
  return (
    <Flex vertical={stacked} gap="middle" align={stacked ? 'stretch' : 'start'}>
      <div style={stacked ? (stackedSideStyle ?? STACKED_SIDE_STYLE) : { width: SIDE_MENU_WIDTH, flex: 'none', ...sideStyle }}>{side}</div>
      <Flex vertical gap="middle" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </Flex>
    </Flex>
  );
}
