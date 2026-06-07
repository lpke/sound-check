import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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

export type HelpTipPlacement =
  | 'bottom'
  | 'bottom-end'
  | 'bottom-start'
  | 'left'
  | 'right'
  | 'top'
  | 'top-end'
  | 'top-start';

export type HelpTipBasePlacement = 'bottom' | 'left' | 'right' | 'top';
export type HelpTipAlignment = 'center' | 'end' | 'start';
export type HelpTipLayout = 'flow' | 'overlay';
export type HelpTipStyle = CSSProperties &
  Partial<Record<`--${string}`, string | number>>;

const HelpModeContext = createContext<HelpModeContextValue | null>(null);
const HELP_MODE_EXIT_MS = 240;
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

export function HelpModeButton({
  showDesktopShadow,
}: {
  showDesktopShadow: boolean;
}) {
  const { isHelpModeActive, isHelpModeExiting, toggleHelpMode } = useHelpMode();
  const isHelpModeOpen = isHelpModeActive && !isHelpModeExiting;

  return (
    <button
      type="button"
      aria-pressed={isHelpModeOpen}
      onClick={toggleHelpMode}
      className={siteActionButtonClassName({
        className: isHelpModeActive ? 'relative z-[70]' : undefined,
        showDesktopShadow,
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
  align,
  arrowAlign,
  arrowClassName,
  bubbleClassName,
  children,
  className,
  highlightClassName = 'rounded-lg',
  label,
  layout = 'flow',
  placement = 'top',
  tipClassName,
  tipStyle,
}: {
  activeClassName?: string;
  align?: HelpTipAlignment;
  arrowAlign?: HelpTipAlignment;
  arrowClassName?: string;
  bubbleClassName?: string;
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  label: ReactNode;
  layout?: HelpTipLayout;
  placement?: HelpTipPlacement;
  tipClassName?: string;
  tipStyle?: HelpTipStyle;
}) {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const basePlacement = getBasePlacement(placement);
  const alignment = align ?? getAlignment(placement);
  const resolvedArrowAlign = arrowAlign ?? alignment;
  const shouldShowBubble = isHelpModeActive;
  const helpBubble = (
    <HelpLabel
      align={alignment}
      arrowAlign={resolvedArrowAlign}
      arrowClassName={arrowClassName}
      bubbleClassName={bubbleClassName}
      isVisible={shouldShowBubble}
      isExiting={isHelpModeExiting}
      label={label}
      layout={layout}
      placement={basePlacement}
      className={tipClassName}
      style={tipStyle}
    />
  );
  const bubbleGoesFirst =
    layout === 'flow' && (basePlacement === 'left' || basePlacement === 'top');

  return (
    <HelpTarget
      activeClassName={activeClassName}
      align={shouldShowBubble && layout === 'flow' ? alignment : undefined}
      className={className}
      flow={shouldShowBubble && layout === 'flow' ? basePlacement : undefined}
      hasHelpLabel={shouldShowBubble}
      isExiting={isHelpModeExiting}
      highlightClassName={highlightClassName}
    >
      {bubbleGoesFirst ? helpBubble : null}
      {children}
      {bubbleGoesFirst ? null : helpBubble}
    </HelpTarget>
  );
}

export function HelpLabel({
  align = 'center',
  arrowAlign = align,
  arrowClassName,
  bubbleClassName,
  className,
  isExiting,
  isVisible,
  label,
  layout = 'flow',
  placement = 'top',
  style,
}: {
  align?: HelpTipAlignment;
  arrowAlign?: HelpTipAlignment;
  arrowClassName?: string;
  bubbleClassName?: string;
  className?: string;
  isExiting?: boolean;
  isVisible?: boolean;
  label: ReactNode;
  layout?: HelpTipLayout;
  placement?: HelpTipBasePlacement;
  style?: HelpTipStyle;
}) {
  const helpMode = useHelpMode();
  const shouldRender = isVisible ?? helpMode.isHelpModeActive;
  const shouldExit = isExiting ?? helpMode.isHelpModeExiting;

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      data-help-align={align}
      data-help-arrow-align={arrowAlign}
      data-help-exiting={shouldExit ? 'true' : undefined}
      data-help-layout={layout}
      data-help-placement={placement}
      data-help-tip-shell="true"
      className={joinClasses(
        'pointer-events-auto relative z-[80] w-max',
        layout === 'overlay' && 'absolute',
        className ?? 'max-w-[min(14rem,calc(100vw-2rem))]',
      )}
      style={style}
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
        <span
          aria-hidden="true"
          className={joinClasses('help-tip-arrow', arrowClassName)}
        />
      </div>
    </div>
  );
}

export function HelpTarget({
  activeClassName = 'z-50',
  align,
  children,
  className,
  flow,
  hasHelpLabel,
  isExiting,
  highlightClassName = 'rounded-lg',
}: {
  activeClassName?: string;
  align?: HelpTipAlignment;
  children: ReactNode;
  className?: string;
  flow?: HelpTipBasePlacement;
  hasHelpLabel?: boolean;
  isExiting?: boolean;
  highlightClassName?: string;
}) {
  const { isHelpModeActive } = useHelpMode();

  return (
    <div
      data-help-align={align}
      data-help-flow={flow}
      data-help-flow-exiting={isExiting ? 'true' : undefined}
      data-help-has-label={hasHelpLabel ? 'true' : undefined}
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
    </div>
  );
}

function getBasePlacement(placement: HelpTipPlacement): HelpTipBasePlacement {
  return placement.split('-')[0] as HelpTipBasePlacement;
}

function getAlignment(placement: HelpTipPlacement): HelpTipAlignment {
  if (placement.endsWith('start')) {
    return 'start';
  }

  if (placement.endsWith('end')) {
    return 'end';
  }

  return 'center';
}
