import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function EditorSection({
  title,
  children,
  defaultOpen = false,
  hint,
  className = '',
  style,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  hint?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`editor-section form-section ${className}`}
      style={style}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="editor-section-body">{children}</div>
    </details>
  );
}
