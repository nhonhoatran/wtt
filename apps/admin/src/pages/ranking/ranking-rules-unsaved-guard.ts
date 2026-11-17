import { App } from 'antd';
import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router';

/**
 * Asks before any in-app navigation or tab close while `when` is true.
 * useBlocker needs a data router and the admin runs under BrowserRouter, so the history methods are wrapped
 * the same way @refinedev/react-router does. Browser back/forward cannot be undone after the fact and is not covered.
 */
export function useUnsavedGuard(when: boolean, message: string) {
  const { navigator } = useContext(NavigationContext);
  const { modal } = App.useApp();
  const asking = useRef(false);

  useEffect(() => {
    if (!when) return;
    const { push, replace, go } = navigator;
    const guard =
      <A extends unknown[]>(original: (...args: A) => void) =>
      (...args: A) => {
        if (asking.current) return;
        asking.current = true;
        modal.confirm({
          title: message,
          okText: 'Bỏ thay đổi',
          cancelText: 'Ở lại',
          onOk: () => {
            asking.current = false;
            original(...args);
          },
          onCancel: () => {
            asking.current = false;
          },
        });
      };
    navigator.push = guard(push);
    navigator.replace = guard(replace);
    navigator.go = guard(go);
    const warnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener('beforeunload', warnUnload);
    return () => {
      navigator.push = push;
      navigator.replace = replace;
      navigator.go = go;
      window.removeEventListener('beforeunload', warnUnload);
    };
  }, [when, message, navigator, modal]);
}
