import { type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clamp } from '@/utils/utils';

const POPOVER_GAP_PX = 8;
const POPOVER_VIEWPORT_MARGIN_PX = 12;

export function Popover({
  anchorRect,
  children,
  isOpen,
  width = 360,
}: {
  anchorRect: DOMRect | null;
  children: ReactNode;
  isOpen: boolean;
  width?: number;
}) {
  const style = isOpen ? getPopoverStyle(anchorRect, width) : null;

  if (!isOpen || !style) {
    return null;
  }

  return createPortal(
    <span
      data-sound-check-popover="true"
      style={style}
      className="bg-panel border-line/70 fixed z-[200] animate-[help-fade-in_120ms_ease-out_both] rounded-md border p-3 text-left text-xs leading-5 font-medium whitespace-normal shadow-[0_18px_54px_rgba(15,23,42,0.28)]"
    >
      {children}
    </span>,
    document.body,
  );
}

function getPopoverStyle(
  anchorRect: DOMRect | null,
  targetWidth: number,
): CSSProperties | null {
  if (!anchorRect) {
    return null;
  }

  const viewportWidth = window.innerWidth;
  const width = Math.min(
    targetWidth,
    viewportWidth - POPOVER_VIEWPORT_MARGIN_PX * 2,
  );
  const left = clamp(
    anchorRect.left + anchorRect.width / 2 - width / 2,
    POPOVER_VIEWPORT_MARGIN_PX,
    viewportWidth - width - POPOVER_VIEWPORT_MARGIN_PX,
  );

  return {
    left,
    top: anchorRect.bottom + POPOVER_GAP_PX,
    width,
  };
}
