import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { joinClasses } from '@/utils/utils';
import { siteActionButtonClassName } from './siteActionStyles';

type HelpModeContextValue = {
  closeHelpMode: () => void;
  isHelpModeActive: boolean;
  isHelpModeExiting: boolean;
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
  boundaryRect: HelpRect | null;
  index: number;
  isPlacementLocked: boolean;
  rect: HelpRect;
  tip: HTMLElement;
};

const HelpModeContext = createContext<HelpModeContextValue | null>(null);
const HELP_LAYOUT_START_DELAY_MS = 210;
const HELP_MODE_EXIT_MS = 180;
const HELP_TARGET_SELECTOR = '[data-help-target="true"]';

function isPointerOverHelpTarget(event: { clientX: number; clientY: number }) {
  return document
    .elementsFromPoint(event.clientX, event.clientY)
    .some(
      (node) =>
        node instanceof HTMLElement &&
        node.closest(HELP_TARGET_SELECTOR) !== null,
    );
}

export function HelpModeProvider({ children }: { children: ReactNode }) {
  const [isHelpModeRendered, setIsHelpModeRendered] = useState(false);
  const [isHelpModeExiting, setIsHelpModeExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current === null) {
      return;
    }

    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }, []);
  const openHelpMode = useCallback(() => {
    clearExitTimer();
    setIsHelpModeRendered(true);
    setIsHelpModeExiting(false);
  }, [clearExitTimer]);
  const closeHelpMode = useCallback(() => {
    if (!isHelpModeRendered || isHelpModeExiting) {
      return;
    }

    clearExitTimer();
    setIsHelpModeExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setIsHelpModeRendered(false);
      setIsHelpModeExiting(false);
      exitTimerRef.current = null;
    }, HELP_MODE_EXIT_MS);
  }, [clearExitTimer, isHelpModeExiting, isHelpModeRendered]);
  const toggleHelpMode = useCallback(() => {
    if (isHelpModeRendered && !isHelpModeExiting) {
      closeHelpMode();
      return;
    }

    openHelpMode();
  }, [closeHelpMode, isHelpModeExiting, isHelpModeRendered, openHelpMode]);
  const contextValue = useMemo(
    () => ({
      closeHelpMode,
      isHelpModeActive: isHelpModeRendered,
      isHelpModeExiting,
      toggleHelpMode,
    }),
    [closeHelpMode, isHelpModeExiting, isHelpModeRendered, toggleHelpMode],
  );

  useEffect(() => {
    return clearExitTimer;
  }, [clearExitTimer]);

  useEffect(() => {
    if (!isHelpModeRendered) {
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
    const mutationObserver = new MutationObserver(scheduleSettledLayout);

    window.addEventListener('scroll', scheduleLayout, { passive: true });
    window.addEventListener('resize', scheduleLayout);
    document.addEventListener('click', scheduleSettledLayout);
    document.addEventListener('change', scheduleSettledLayout);
    document.addEventListener('input', scheduleSettledLayout);
    document.addEventListener('transitionend', scheduleLayout);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.clearTimeout(initialLayoutTimer);
      settleTimers.forEach((settleTimer) => window.clearTimeout(settleTimer));
      mutationObserver.disconnect();

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
  }, [isHelpModeRendered]);

  return (
    <HelpModeContext.Provider value={contextValue}>
      {children}
      {isHelpModeRendered ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close help"
          className={joinClasses(
            'fixed inset-0 z-40 cursor-default',
            isHelpModeExiting
              ? 'animate-[help-fade-out_160ms_ease-in_both]'
              : 'animate-[help-fade-in_180ms_ease-out_both]',
          )}
          onClick={(event) => {
            if (isPointerOverHelpTarget(event)) {
              return;
            }

            closeHelpMode();
          }}
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
      isHelpModeExiting: false,
      toggleHelpMode: () => undefined,
    }
  );
}

export function HelpModeButton() {
  const { isHelpModeActive, isHelpModeExiting, toggleHelpMode } = useHelpMode();
  const isHelpModeOpen = isHelpModeActive && !isHelpModeExiting;

  return (
    <button
      type="button"
      aria-pressed={isHelpModeOpen}
      onClick={toggleHelpMode}
      className={siteActionButtonClassName({
        className: isHelpModeActive ? 'relative z-[70]' : undefined,
        tone: isHelpModeOpen ? 'danger' : 'default',
        widthClassName: isHelpModeOpen ? 'w-28' : 'w-20',
      })}
    >
      {isHelpModeOpen ? 'Exit Help' : 'Help'}
    </button>
  );
}

export function HelpTip({
  activeClassName = 'z-50',
  bubbleClassName,
  children,
  className,
  highlightClassName = 'rounded-lg',
  label,
  lockedPlacement = false,
  placement = 'top',
  shellClassName,
  showBubble = true,
}: {
  activeClassName?: string;
  bubbleClassName?: string;
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  label: string;
  lockedPlacement?: boolean;
  placement?: HelpTipPlacement;
  shellClassName?: string;
  showBubble?: boolean;
}) {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();

  return (
    <div
      data-help-target="true"
      className={joinClasses(
        'relative',
        isHelpModeActive &&
          joinClasses(
            'help-target-shell',
            'help-highlight-zone',
            'animate-[help-highlight-in_180ms_ease-out_both]',
            activeClassName,
            highlightClassName,
          ),
        className,
      )}
    >
      {children}
      {isHelpModeActive && showBubble ? (
        <>
          <div
            data-help-locked-placement={lockedPlacement ? 'true' : undefined}
            data-help-exiting={isHelpModeExiting ? 'true' : undefined}
            data-help-preferred-placement={placement}
            data-help-tip-shell="true"
            className={joinClasses(
              'pointer-events-auto fixed top-0 left-0 z-[80] w-max',
              shellClassName ?? 'max-w-[min(14rem,calc(100vw-2rem))]',
            )}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div
              role="tooltip"
              className={joinClasses(
                'help-tip-bubble relative rounded-lg border px-2.5 py-1.5 text-xs leading-4 font-semibold shadow-[0_18px_42px_rgba(15,23,42,0.28)]',
                bubbleClassName,
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
  ).filter((target) =>
    target.querySelector(':scope > [data-help-tip-shell="true"]'),
  );
  const bounds = getViewportBounds();
  const placedTipRects: HelpRect[] = [];
  const targetEntries = targets.reduce<HelpTargetEntry[]>((entries, target) => {
    const anchor =
      target.querySelector<HTMLElement>('[data-help-anchor="true"]') ?? target;
    const rect = toHelpRect(anchor);
    const tip = target.querySelector<HTMLElement>(
      ':scope > [data-help-tip-shell="true"]',
    );

    if (!rect || !tip) {
      return entries;
    }

    if (!isTargetVisibleEnough(rect, bounds)) {
      tip.removeAttribute('data-help-ready');
      return entries;
    }

    entries.push({
      boundaryRect: getHelpBoundaryRect(target),
      index: entries.length,
      isPlacementLocked: tip.dataset.helpLockedPlacement === 'true',
      rect,
      tip,
    });

    return entries;
  }, []);
  const targetRects = targetEntries.map(({ rect }) => rect);

  targetEntries
    .sort((first, second) => first.rect.top - second.rect.top)
    .forEach(
      ({ boundaryRect, index, isPlacementLocked, rect: targetRect, tip }) => {
        const preferredPlacement = parsePlacement(
          tip.dataset.helpPreferredPlacement,
        );
        const tipSize = measureTip(tip);
        const placement = chooseHelpTipPlacement({
          allTargetRects: targetRects,
          boundaryRect,
          isPlacementLocked,
          placedTipRects,
          preferredPlacement,
          targetIndex: index,
          targetRect,
          tipSize,
        });

        if (!placement) {
          tip.removeAttribute('data-help-ready');
          return;
        }

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
        setArrowOffset({
          basePlacement: placement.basePlacement,
          preferredPlacement,
          targetRect,
          tip,
          tipRect,
        });
        placedTipRects.push(tipRect);
      },
    );
}

function chooseHelpTipPlacement({
  allTargetRects,
  boundaryRect,
  isPlacementLocked,
  placedTipRects,
  preferredPlacement,
  targetIndex,
  targetRect,
  tipSize,
}: {
  allTargetRects: HelpRect[];
  boundaryRect: HelpRect | null;
  isPlacementLocked: boolean;
  placedTipRects: HelpRect[];
  preferredPlacement: HelpTipPlacement;
  targetIndex: number;
  targetRect: HelpRect;
  tipSize: Pick<HelpRect, 'height' | 'width'>;
}): HelpPlacementCandidate | null {
  const bounds = getViewportBounds();
  const placementBounds = getPlacementBounds(bounds, boundaryRect);
  const candidates = getPlacementOrder({
    isPlacementLocked,
    preferredPlacement,
  }).flatMap((basePlacement) =>
    getPlacementCandidate({
      basePlacement,
      bounds: placementBounds,
      isPlacementLocked,
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

  return bestCandidate ?? null;
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
  isPlacementLocked,
  preferred,
  preferredPlacement,
  targetRect,
  tipSize,
}: {
  basePlacement: HelpTipBasePlacement;
  bounds: HelpRect;
  isPlacementLocked: boolean;
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
  const crossAxisOffsets = isPlacementLocked
    ? [0]
    : basePlacement === 'top' || basePlacement === 'bottom'
      ? [0, -48, 48, -96, 96, -144, 144, -192, 192]
      : [0, -40, 40, -80, 80, -120, 120];
  const mainAxisOffsets = isPlacementLocked
    ? getLockedMainAxisOffsets()
    : getMainAxisOffsets(basePlacement);
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

function getLockedMainAxisOffsets() {
  return [0];
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

function getHelpBoundaryRect(target: HTMLElement) {
  const boundary = target.closest<HTMLElement>('[data-help-boundary="true"]');

  if (!boundary) {
    return null;
  }

  return toHelpRect(boundary);
}

function getPlacementBounds(bounds: HelpRect, boundaryRect: HelpRect | null) {
  if (!boundaryRect) {
    return bounds;
  }

  const boundaryInset = 8;
  const left = Math.max(bounds.left, boundaryRect.left + boundaryInset);
  const right = Math.min(bounds.right, boundaryRect.right - boundaryInset);

  if (right <= left) {
    return bounds;
  }

  return {
    ...bounds,
    left,
    right,
    width: right - left,
  };
}

function getPlacementOrder({
  isPlacementLocked,
  preferredPlacement,
}: {
  isPlacementLocked: boolean;
  preferredPlacement: HelpTipPlacement;
}) {
  const basePlacement = getBasePlacement(preferredPlacement);

  if (isPlacementLocked) {
    return [basePlacement];
  }

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

function setArrowOffset({
  basePlacement,
  preferredPlacement,
  targetRect,
  tip,
  tipRect,
}: {
  basePlacement: HelpTipBasePlacement;
  preferredPlacement: HelpTipPlacement;
  targetRect: HelpRect;
  tip: HTMLElement;
  tipRect: HelpRect;
}) {
  if (basePlacement === 'top' || basePlacement === 'bottom') {
    const targetOffset = Math.min(24, targetRect.width / 2);
    const targetX = preferredPlacement.endsWith('start')
      ? targetRect.left + targetOffset
      : preferredPlacement.endsWith('end')
        ? targetRect.right - targetOffset
        : targetRect.left + targetRect.width / 2;
    const arrowInset = Math.min(18, tipRect.width / 2);
    const arrowLeft = clamp(
      targetX - tipRect.left,
      arrowInset,
      tipRect.width - arrowInset,
    );

    tip.style.setProperty('--help-arrow-left', `${arrowLeft}px`);
    tip.style.removeProperty('--help-arrow-top');
    return;
  }

  const targetCenterY = targetRect.top + targetRect.height / 2;
  const arrowInset = Math.min(18, tipRect.height / 2);
  const arrowTop = clamp(
    targetCenterY - tipRect.top,
    arrowInset,
    tipRect.height - arrowInset,
  );

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
