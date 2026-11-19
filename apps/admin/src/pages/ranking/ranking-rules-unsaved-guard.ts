import { App } from 'antd';
import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * The data router blocks application links and native browser history before the route unmounts.
 * Full document navigation and tab close use the browser's beforeunload confirmation.
 */
export function useUnsavedGuard(when: boolean, message: string) {
  const blocker = useBlocker(when);
  const { modal } = App.useApp();

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (!when) { blocker.reset(); return; }
    const dialog = modal.confirm({
      title: message,
      okText: 'Bỏ thay đổi',
      cancelText: 'Ở lại',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker, when, modal, message]);

  useEffect(() => {
    if (!when) return;
    const warnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener('beforeunload', warnUnload);
    return () => window.removeEventListener('beforeunload', warnUnload);
  }, [when, message]);
}
