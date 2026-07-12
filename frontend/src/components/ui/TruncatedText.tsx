import { useEffect, useRef, useState } from 'react';

interface TruncatedTextProps {
  text: string;
  className?: string;
}

/** Shows native title only when the text is visually truncated. */
export function TruncatedText({ text, className = '' }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text]);

  if (!text) return <span className={className}>—</span>;

  return (
    <span
      ref={ref}
      className={`block truncate ${className}`}
      title={truncated ? text : undefined}
    >
      {text}
    </span>
  );
}
