// Two routes don't need a router library: the History API and one hook.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const subscribe = (notify: () => void) => {
  addEventListener('popstate', notify);
  return () => removeEventListener('popstate', notify);
};

export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname);

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
  scrollTo(0, 0);
}

export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={follow} {...props} />;
}
