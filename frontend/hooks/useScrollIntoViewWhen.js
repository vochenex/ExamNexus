import { useEffect, useRef } from "react";

/**
 * Returns a ref that scrolls into view whenever `active` is truthy
 * (and again when `deps` change while still active).
 */
export function useScrollIntoViewWhen(
  active,
  { behavior = "smooth", block = "center", delayMs = 80, deps = [] } = {}
) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    const timer = window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior, block });
    }, delayMs);

    return () => window.clearTimeout(timer);
    // Intentionally include caller deps so content updates re-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, behavior, block, delayMs, ...deps]);

  return ref;
}
