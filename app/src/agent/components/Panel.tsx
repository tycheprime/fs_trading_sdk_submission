import type { CSSProperties, ReactNode } from 'react';

interface PanelProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  bodyStyle?: CSSProperties;
  style?: CSSProperties;
}

// A titled card matching the terminal theme. Used for every dashboard section.
export function Panel({ title, right, children, bodyStyle, style }: PanelProps) {
  return (
    <section
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...style,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--fs-border)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--fs-text-secondary)',
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        {right}
      </header>
      <div style={{ padding: 14, minHeight: 0, ...bodyStyle }}>{children}</div>
    </section>
  );
}
