import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Fit a tile's complete design to its slot, independently of the display scale. */
export function FittedTile({
  children,
  minWidth,
  minHeight,
  scrollable = false,
  enabled = true,
}: {
  children: ReactNode;
  minWidth: number;
  minHeight: number;
  scrollable?: boolean;
  enabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const slot = host.current!,
      canvas = content.current!;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const width = slot.clientWidth,
        height = slot.clientHeight;
      if (width <= 0 || height <= 0) return;
      let scale = Math.min(1, width / minWidth, height / minHeight);
      // Re-measure at the logical size: wrapped labels and translated text can
      // need more room than the baseline. Limit work to avoid resize feedback.
      for (let pass = 0; pass < 4; pass++) {
        const logicalWidth = width / scale,
          logicalHeight = height / scale;
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;
        canvas.style.transform = `scale(${scale})`;
        slot.style.borderRadius = `${26 * scale}px`;
        canvas.dataset.scale = scale.toFixed(3);
        const tile = canvas.firstElementChild as HTMLElement | null;
        if (!tile) break;
        const requiredWidth = Math.max(logicalWidth, tile.scrollWidth + 2);
        const requiredHeight = scrollable
          ? logicalHeight
          : Math.max(logicalHeight, tile.scrollHeight + 2);
        const next = Math.min(scale, width / requiredWidth, height / requiredHeight);
        if (scale - next < 0.005) break;
        scale = next;
      }
    };
    const requestFit = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    const resize = new ResizeObserver(requestFit);
    resize.observe(slot);
    const changes = new MutationObserver(requestFit);
    changes.observe(canvas, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
    const dashboard = slot.closest('.dashboard-frame');
    if (dashboard)
      changes.observe(dashboard, { attributes: true, attributeFilter: ['data-density'] });
    fit();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      changes.disconnect();
    };
  }, [enabled, minWidth, minHeight, scrollable]);
  if (!enabled) return children;
  return (
    <div className="tile-fit-shell" ref={host}>
      <div className="tile-fit-inner" ref={content}>
        {children}
      </div>
    </div>
  );
}
