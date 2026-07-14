import { useEffect, useRef, useState } from 'react';

interface TruncatedTextProps {
  text: string;
  className?: string;
  /** Use >1 for multi-line clamp (e.g. rejection reason). */
  lines?: 1 | 2 | 3;
}

/** Ellipsis truncation; native tooltip only when text is actually clipped. */
export function TruncatedText({ text, className = '', lines = 1 }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (lines > 1) {
        setTruncated(el.scrollHeight > el.clientHeight + 1);
      } else {
        setTruncated(el.scrollWidth > el.clientWidth + 1);
      }
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    window.addEventListener('resize', check);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [text, lines]);

  if (!text) return <span className={className}>—</span>;

  const clampClass =
    lines > 1
      ? `block min-w-0 overflow-hidden break-words ${lines === 2 ? 'line-clamp-2' : 'line-clamp-3'}`
      : 'block min-w-0 truncate';

  return (
    <span
      ref={ref}
      className={`${clampClass} ${className}`}
      title={truncated ? text : undefined}
    >
      {text}
    </span>
  );
}
