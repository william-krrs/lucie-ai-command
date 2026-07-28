import { useEffect, useRef, useState } from "react";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// Ease-out cubic — feels premium and calm.
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  value,
  duration = 900,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [n, setN] = useState<number>(reduced ? value : 0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setN(value);
      return;
    }
    fromRef.current = n;
    startRef.current = null;
    const target = value;
    const from = fromRef.current;
    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const v = from + (target - from) * ease(p);
      setN(v);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduced]);

  const rendered = format ? format(n) : Math.round(n).toLocaleString("fr-FR");
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {rendered}
    </span>
  );
}

export { useReducedMotion };