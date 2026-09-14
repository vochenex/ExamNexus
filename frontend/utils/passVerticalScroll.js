/**
 * Forward vertical wheel to `main.en-scroll-region` when the cursor is over a
 * nested scrollport that only scrolls horizontally (or is already at its Y edge).
 * Browsers treat overflow-x:auto as a scroll container and often trap the wheel.
 */
export function installPassVerticalScroll() {
  const onWheel = (event) => {
    if (event.ctrlKey || event.metaKey) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (!(event.target instanceof Element)) return;

    const main = document.querySelector("main.en-scroll-region");
    if (!main || !main.contains(event.target)) return;

    let el = event.target;
    while (el && el !== main) {
      if (el instanceof HTMLElement) {
        const { overflowY, overflowX } = getComputedStyle(el);
        const yPort = /(auto|scroll|overlay)/.test(overflowY);
        const xPort = /(auto|scroll|overlay)/.test(overflowX);
        if (!yPort && !xPort) {
          el = el.parentElement;
          continue;
        }

        const canScrollY = el.scrollHeight > el.clientHeight + 1;
        if (canScrollY && yPort) {
          const up = event.deltaY < 0;
          const down = event.deltaY > 0;
          const atTop = el.scrollTop <= 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if ((up && !atTop) || (down && !atBottom)) {
            return;
          }
          main.scrollTop += event.deltaY;
          event.preventDefault();
          return;
        }

        // Horizontal-only (or forced overflow-y:auto with no Y overflow): page scroll
        main.scrollTop += event.deltaY;
        event.preventDefault();
        return;
      }
      el = el.parentElement;
    }
  };

  document.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () => document.removeEventListener("wheel", onWheel, { capture: true });
}
