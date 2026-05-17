import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Full page navigation home — bypasses React Router v7 client nav (stale route tree). */
export function MarketsLink({
  children,
  className,
  type,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type={type ?? 'button'}
      className={className}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented) return;
        window.location.assign('/');
      }}
    >
      {children}
    </button>
  );
}
