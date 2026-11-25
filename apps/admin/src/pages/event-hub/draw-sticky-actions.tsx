import { theme } from 'antd';
import type { ReactNode } from 'react';

interface DrawStickyActionsProps {
  /** Pin to the bottom of the viewport while the section is on screen (draft draws). */
  sticky: boolean;
  children: ReactNode;
}

/** Sticky inside the section flow (not fixed), so it never covers the content that follows. */
export function DrawStickyActions({ sticky, children }: DrawStickyActionsProps) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        ...(sticky
          ? {
              position: 'sticky',
              bottom: 0,
              zIndex: 5,
              padding: token.paddingSM,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
}
