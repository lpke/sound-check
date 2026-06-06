import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { joinClasses } from '@/utils/utils';
import { siteActionButtonClassName } from './siteActionStyles';

type HelpModeContextValue = {
  closeHelpMode: () => void;
  isHelpModeActive: boolean;
  toggleHelpMode: () => void;
};

type HelpTipPlacement =
  | 'bottom'
  | 'bottom-end'
  | 'bottom-start'
  | 'left'
  | 'right'
  | 'top'
  | 'top-end'
  | 'top-start';

type HelpTipBasePlacement = 'bottom' | 'left' | 'right' | 'top';

type HelpRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type HelpPlacementCandidate = {
  basePlacement: HelpTipBasePlacement;
  left: number;
  offsetDistance: number;
  preferred: boolean;
  top: number;
};

type HelpPlacementSideLimits = {
  maxLeft: number;
  maxTop: number;
  minLeft: number;
  minTop: number;
};

type HelpTargetEntry = {
  index: number;
  rect: HelpRect;
  tip: HTMLElement;
};

const HelpModeContext = createContext<HelpModeContextValue | null>(null);
const HELP_LAYOUT_START_DELAY_MS = 210;

export function HelpModeProvider({ children }: { children: ReactNode }) {
  const [isHelpModeActive, setIsHelpModeActive] = useState(false);
  const contextValue = useMemo(
    () => ({
      closeHelpMode: () => setIsHelpModeActive(false),
      isHelpModeActive,
      toggleHelpMode: () => setIsHelpModeActive((current) => !current),
    }),
    [isHelpModeActive],
  );

  useEffect(() => {
    if (!isHelpModeActive) {
      return undefined;
    }

    let frame: number | null = null;
    let canLayout = false;
    const settleTimers = new Set<number>();
    const initialLayoutTimer = window.setTimeout(() => {
      canLayout = true;
      scheduleLayout();
    }, HELP_LAYOUT_START_DELAY_MS);

    const scheduleLayout = () => {
      if (!canLayout) {
        return;
      }

      if (frame !== null) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = null;
        layoutHelpTips();
      });
    };

    const scheduleSettledLayout = () => {
      scheduleLayout();

      const settleTimer = window.setTimeout(() => {
        settleTimers.delete(settleTimer);
        scheduleLayout();
      }, 360);

      settleTimers.add(settleTimer);
    };

    window.addEventListener('scroll', scheduleLayout, { passive: true });
    window.addEventListener('resize', scheduleLayout);
    document.addEventListener('click', scheduleSettledLayout);
    document.addEventListener('change', scheduleSettledLayout);
    document.addEventListener('input', scheduleSettledLayout);
    document.addEventListener('transitionend', scheduleLayout);

    return () => {
      window.clearTimeout(initialLayoutTimer);
      settleTimers.forEach((settleTimer) => window.clearTimeout(settleTimer));

      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener('scroll', scheduleLayout);
      window.removeEventListener('resize', scheduleLayout);
      document.removeEventListener('click', scheduleSettledLayout);
      document.removeEventListener('change', scheduleSettledLayout);
      document.removeEventListener('input', scheduleSettledLayout);
      document.removeEventListener('transitionend', scheduleLayout);
    };
  }, [isHelpModeActive]);

  return (
    <HelpModeContext.Provider value={contextValue}>
      {children}
      {isHelpModeActive ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close help"
          className="bg-foreground/25 fixed inset-0 z-40 animate-[help-fade-in_180ms_ease-out_both] cursor-default sm:backdrop-blur-[1px]"
          onClick={() => setIsHelpModeActive(false)}
        />
      ) : null}
    </HelpModeContext.Provider>
  );
}

export function useHelpMode() {
  return (
    useContext(HelpModeContext) ?? {
      closeHelpMode: () => undefined,
      isHelpModeActive: false,
      toggleHelpMode: () => undefined,
    }
  );
}

export function HelpModeButton() {
  const { isHelpModeActive, toggleHelpMode } = useHelpMode();

  return (
    <button
      type="button"
      aria-pressed={isHelpModeActive}
      onClick={toggleHelpMode}
      className={siteActionButtonClassName({
        className: isHelpModeActive ? 'relative z-[70]' : undefined,
        tone: isHelpModeActive ? 'danger' : 'default',
        widthClassName: isHelpModeActive ? 'w-28' : 'w-20',
      })}
    >
      {isHelpModeActive ? 'Exit Help' : 'Help'}
    </button>
  );
}

export function HelpTip({
  activeClassName = 'z-50',
  children,
  className,
  highlightClassName = 'rounded-lg',
  label,
  placement = 'top',
}: {
  activeClassName?: string;
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  label: string;
  placement?: HelpTipPlacement;
}) {
  const { isHelpModeActive } = useHelpMode();

  return (
    <div
      data-help-target="true"
      className={joinClasses(
        'relative',
        isHelpModeActive &&
          joinClasses(
            'ring-foreground/12 ring-offset-background animate-[help-highlight-in_180ms_ease-out_both] shadow-[0_14px_34px_rgba(15,23,42,0.18)] ring-1 ring-offset-2',
            activeClassName,
            highlightClassName,
          ),
        className,
      )}
    >
      {children}
      {isHelpModeActive ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-white/30 mix-blend-screen"
          />
          <div
            data-help-preferred-placement={placement}
            data-help-tip-shell="true"
            className={joinClasses(
              'pointer-events-auto fixed top-0 left-0 z-[80] w-max max-w-[min(14rem,calc(100vw-2rem))]',
            )}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              role="tooltip"
              className={joinClasses(
                'help-tip-bubble border-line bg-panel text-foreground relative rounded-lg border px-2.5 py-1.5 text-xs leading-4 font-semibold shadow-[0_18px_42px_rgba(15,23,42,0.28)]',
              )}
            >
              {label}
              <span aria-hidden="true" className="help-tip-arrow" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function layoutHelpTips() {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-help-target="true"]'),
  ).filter((target) => target.querySelector('[data-help-tip-shell="true"]'));
  const bounds = getViewportBounds();
  const placedTipRects: HelpRect[] = [];
  const targetEntries = targets.reduce<HelpTargetEntry[]>((entries, target) => {
    const rect = toHelpRect(target);
    const tip = target.querySelector<HTMLElement>(
      '[data-help-tip-shell="true"]',
    );

    if (!rect || !tip) {
      return entries;
    }

    if (!isTargetVisibleEnough(rect, bounds)) {
      tip.removeAttribute('data-help-ready');
      return entries;
    }

    entries.push({
      index: entries.length,
      rect,
      tip,
    });

    return entries;
  }, []);
  const targetRects = targetEntries.map(({ rect }) => rect);

  targetEntries
    .sort((first, second) => first.rect.top - second.rect.top)
    .forEach(({ index, rect: targetRect, tip }) => {
      const preferredPlacement = parsePlacement(
        tip.dataset.helpPreferredPlacement,
      );
      const tipSize = measureTip(tip);
      const placement = chooseHelpTipPlacement({
        allTargetRects: targetRects,
        placedTipRects,
        preferredPlacement,
        targetIndex: index,
        targetRect,
        tipSize,
      });
      const tipRect = toRect({
        height: tipSize.height,
        left: placement.left,
        top: placement.top,
        width: tipSize.width,
      });

      tip.style.left = `${placement.left}px`;
      tip.style.top = `${placement.top}px`;
      tip.dataset.helpPlacement = placement.basePlacement;
      tip.dataset.helpReady = 'true';
      setArrowOffset(tip, targetRect, tipRect, placement.basePlacement);
      placedTipRects.push(tipRect);
    });
}

function chooseHelpTipPlacement({
  allTargetRects,
  placedTipRects,
  preferredPlacement,
  targetIndex,
  targetRect,
  tipSize,
}: {
  allTargetRects: HelpRect[];
  placedTipRects: HelpRect[];
  preferredPlacement: HelpTipPlacement;
  targetIndex: number;
  targetRect: HelpRect;
  tipSize: Pick<HelpRect, 'height' | 'width'>;
}): HelpPlacementCandidate {
  const bounds = getViewportBounds();
  const candidates = getPlacementOrder(preferredPlacement).flatMap(
    (basePlacement) =>
      getPlacementCandidate({
        basePlacement,
        bounds,
        preferred: basePlacement === getBasePlacement(preferredPlacement),
        preferredPlacement,
        targetRect,
        tipSize,
      }),
  );

  const bestCandidate = candidates
    .map((candidate) => ({
      ...candidate,
      score: getPlacementScore({
        allTargetRects,
        candidate,
        placedTipRects,
        preferredPlacement,
        targetIndex,
        tipSize,
      }),
    }))
    .sort((first, second) => first.score - second.score)[0];

  const fallbackCandidate = getPlacementCandidate({
    basePlacement: 'bottom',
    bounds,
    preferred: false,
    preferredPlacement,
    targetRect,
    tipSize,
  })[0];

  return (
    bestCandidate ??
    fallbackCandidate ?? {
      basePlacement: 'bottom',
      left: bounds.left,
      offsetDistance: 0,
      preferred: false,
      top: bounds.top,
    }
  );
}

function getPlacementScore({
  allTargetRects,
  candidate,
  placedTipRects,
  targetIndex,
  tipSize,
}: {
  allTargetRects: HelpRect[];
  candidate: HelpPlacementCandidate;
  placedTipRects: HelpRect[];
  preferredPlacement: HelpTipPlacement;
  targetIndex: number;
  tipSize: Pick<HelpRect, 'height' | 'width'>;
}) {
  const rect = toRect({
    height: tipSize.height,
    left: candidate.left,
    top: candidate.top,
    width: tipSize.width,
  });
  let score = candidate.preferred ? 0 : 32;

  score += candidate.offsetDistance * 1.2;

  placedTipRects.forEach((placedRect) => {
    score += getOverlapArea(rect, placedRect, 8) * 3;
  });
  allTargetRects.forEach((targetRect, index) => {
    score +=
      getOverlapArea(rect, targetRect, 4) * (index === targetIndex ? 4 : 2);
  });

  return score;
}

function getPlacementCandidate({
  basePlacement,
  bounds,
  preferred,
  preferredPlacement,
  targetRect,
  tipSize,
}: {
  basePlacement: HelpTipBasePlacement;
  bounds: HelpRect;
  preferred: boolean;
  preferredPlacement: HelpTipPlacement;
  targetRect: HelpRect;
  tipSize: Pick<HelpRect, 'height' | 'width'>;
}): HelpPlacementCandidate[] {
  const gap = 12;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const alignX = () => {
    if (preferredPlacement.endsWith('start')) {
      return targetRect.left;
    }

    if (preferredPlacement.endsWith('end')) {
      return targetRect.right - tipSize.width;
    }

    return targetCenterX - tipSize.width / 2;
  };
  const alignY = () => targetCenterY - tipSize.height / 2;
  const unclamped =
    basePlacement === 'top'
      ? { left: alignX(), top: targetRect.top - tipSize.height - gap }
      : basePlacement === 'bottom'
        ? { left: alignX(), top: targetRect.bottom + gap }
        : basePlacement === 'left'
          ? { left: targetRect.left - tipSize.width - gap, top: alignY() }
          : { left: targetRect.right + gap, top: alignY() };
  const crossAxisOffsets =
    basePlacement === 'top' || basePlacement === 'bottom'
      ? [0, -48, 48, -96, 96, -144, 144, -192, 192]
      : [0, -40, 40, -80, 80, -120, 120];
  const mainAxisOffsets = getMainAxisOffsets(basePlacement);
  const sideLimits = getPlacementSideLimits({
    basePlacement,
    bounds,
    gap,
    targetRect,
    tipSize,
  });

  if (!sideLimits) {
    return [];
  }

  return crossAxisOffsets.flatMap((crossAxisOffset) =>
    mainAxisOffsets.map((mainAxisOffset) => {
      const leftOffset =
        basePlacement === 'top' || basePlacement === 'bottom'
          ? crossAxisOffset
          : mainAxisOffset;
      const topOffset =
        basePlacement === 'top' || basePlacement === 'bottom'
          ? mainAxisOffset
          : crossAxisOffset;

      return {
        basePlacement,
        left: clamp(
          unclamped.left + leftOffset,
          sideLimits.minLeft,
          sideLimits.maxLeft,
        ),
        offsetDistance: Math.abs(crossAxisOffset) + Math.abs(mainAxisOffset),
        preferred,
        top: clamp(
          unclamped.top + topOffset,
          sideLimits.minTop,
          sideLimits.maxTop,
        ),
      };
    }),
  );
}

function getMainAxisOffsets(placement: HelpTipBasePlacement) {
  switch (placement) {
    case 'bottom':
      return [0, 32, 64];
    case 'left':
      return [0, -24, -48];
    case 'right':
      return [0, 24, 48];
    case 'top':
      return [0, -32, -64];
  }
}

function getPlacementSideLimits({
  basePlacement,
  bounds,
  gap,
  targetRect,
  tipSize,
}: {
  basePlacement: HelpTipBasePlacement;
  bounds: HelpRect;
  gap: number;
  targetRect: HelpRect;
  tipSize: Pick<HelpRect, 'height' | 'width'>;
}): HelpPlacementSideLimits | null {
  const viewportMaxLeft = bounds.right - tipSize.width;
  const viewportMaxTop = bounds.bottom - tipSize.height;

  const limits =
    basePlacement === 'top'
      ? {
          maxLeft: viewportMaxLeft,
          maxTop: targetRect.top - tipSize.height - gap,
          minLeft: bounds.left,
          minTop: bounds.top,
        }
      : basePlacement === 'bottom'
        ? {
            maxLeft: viewportMaxLeft,
            maxTop: viewportMaxTop,
            minLeft: bounds.left,
            minTop: targetRect.bottom + gap,
          }
        : basePlacement === 'left'
          ? {
              maxLeft: targetRect.left - tipSize.width - gap,
              maxTop: viewportMaxTop,
              minLeft: bounds.left,
              minTop: bounds.top,
            }
          : {
              maxLeft: viewportMaxLeft,
              maxTop: viewportMaxTop,
              minLeft: targetRect.right + gap,
              minTop: bounds.top,
            };

  if (limits.maxLeft < limits.minLeft || limits.maxTop < limits.minTop) {
    return null;
  }

  return limits;
}

function getPlacementOrder(preferredPlacement: HelpTipPlacement) {
  const basePlacement = getBasePlacement(preferredPlacement);
  const oppositePlacement = getOppositePlacement(basePlacement);

  return [
    basePlacement,
    oppositePlacement,
    'right',
    'left',
    'bottom',
    'top',
  ].filter(
    (placement, index, placements): placement is HelpTipBasePlacement =>
      placements.indexOf(placement) === index,
  );
}

function getBasePlacement(placement: HelpTipPlacement): HelpTipBasePlacement {
  return placement.split('-')[0] as HelpTipBasePlacement;
}

function getOppositePlacement(
  placement: HelpTipBasePlacement,
): HelpTipBasePlacement {
  switch (placement) {
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'top':
      return 'bottom';
  }
}

function parsePlacement(placement?: string): HelpTipPlacement {
  if (
    placement === 'bottom' ||
    placement === 'bottom-end' ||
    placement === 'bottom-start' ||
    placement === 'left' ||
    placement === 'right' ||
    placement === 'top' ||
    placement === 'top-end' ||
    placement === 'top-start'
  ) {
    return placement;
  }

  return 'top';
}

function setArrowOffset(
  tip: HTMLElement,
  targetRect: HelpRect,
  tipRect: HelpRect,
  placement: HelpTipBasePlacement,
) {
  if (placement === 'top' || placement === 'bottom') {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const arrowLeft = clamp(
      targetCenterX - tipRect.left,
      18,
      tipRect.width - 18,
    );

    tip.style.setProperty('--help-arrow-left', `${arrowLeft}px`);
    tip.style.removeProperty('--help-arrow-top');
    return;
  }

  const targetCenterY = targetRect.top + targetRect.height / 2;
  const arrowTop = clamp(targetCenterY - tipRect.top, 18, tipRect.height - 18);

  tip.style.setProperty('--help-arrow-top', `${arrowTop}px`);
  tip.style.removeProperty('--help-arrow-left');
}

function measureTip(tip: HTMLElement) {
  const previousLeft = tip.style.left;
  const previousTop = tip.style.top;

  tip.style.left = '0px';
  tip.style.top = '0px';

  const rect = toHelpRect(tip);

  tip.style.left = previousLeft;
  tip.style.top = previousTop;

  return rect;
}

function getViewportBounds(): HelpRect {
  const margin = 10;
  const helpBarHeight = 68;

  return {
    bottom: window.innerHeight - margin,
    height: window.innerHeight - helpBarHeight - margin,
    left: margin,
    right: window.innerWidth - margin,
    top: helpBarHeight,
    width: window.innerWidth - margin * 2,
  };
}

function isTargetVisibleEnough(rect: HelpRect, bounds: HelpRect) {
  const visibleWidth =
    Math.min(bounds.right, rect.right) - Math.max(bounds.left, rect.left);
  const visibleHeight =
    Math.min(bounds.bottom, rect.bottom) - Math.max(bounds.top, rect.top);

  return (
    visibleWidth >= Math.min(rect.width * 0.35, 120) &&
    visibleHeight >= Math.min(rect.height * 0.35, 96)
  );
}

function toHelpRect(element: HTMLElement): HelpRect {
  const rect = element.getBoundingClientRect();

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function toRect({
  height,
  left,
  top,
  width,
}: Pick<HelpRect, 'height' | 'left' | 'top' | 'width'>): HelpRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  };
}

function getOverlapArea(firstRect: HelpRect, secondRect: HelpRect, pad = 0) {
  const left = Math.max(firstRect.left - pad, secondRect.left - pad);
  const right = Math.min(firstRect.right + pad, secondRect.right + pad);
  const top = Math.max(firstRect.top - pad, secondRect.top - pad);
  const bottom = Math.min(firstRect.bottom + pad, secondRect.bottom + pad);

  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
