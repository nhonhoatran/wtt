import { Flex, Grid } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { SIDE_MENU_WIDTH } from './entry-labels';

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
      <div style={stacked ? stackedSideStyle : { width: SIDE_MENU_WIDTH, flex: 'none', ...sideStyle }}>{side}</div>
      <Flex vertical gap="middle" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </Flex>
    </Flex>
  );
}
