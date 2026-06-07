'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { joinClasses } from '@/utils/utils';

const EXIT_MS = 280;
const SCROLL_LOCK_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
]);

type ModalRenderProps = {
  close: () => void;
};

type ModalChildren = ReactNode | ((props: ModalRenderProps) => ReactNode);

type ModalProps = {
  children: ModalChildren;
  className?: string;
  closeWhen?: boolean;
  modalAriaLabel?: string;
  onOpen?: () => void;
  title?: ReactNode;
  trigger: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
};

export function Modal({
  children,
  className,
  closeWhen = false,
  modalAriaLabel = 'Modal',
  onOpen,
  title,
  trigger,
  triggerAriaLabel = 'Open modal',
  triggerClassName,
  triggerStyle,
}: ModalProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{
    scrollContainer: HTMLElement | null;
    y: number;
  } | null>(null);
  const shouldRestoreFocusRef = useRef(false);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const isClosing = phase === 'closing';
  const isVisible = phase !== 'closed';

  const open = useCallback(() => {
    onOpen?.();
    setPhase('open');
  }, [onOpen]);

  const close = useCallback(() => {
    setPhase((currentPhase) =>
      currentPhase === 'open' ? 'closing' : currentPhase,
    );
  }, []);

  useEffect(() => {
    if (closeWhen && isVisible) {
      const closeTimer = window.setTimeout(close, 0);

      return () => {
        window.clearTimeout(closeTimer);
      };
    }

    return undefined;
  }, [close, closeWhen, isVisible]);

  useEffect(() => {
    if (phase !== 'closing') {
      return undefined;
    }

    const closeTimer = window.setTimeout(() => {
      shouldRestoreFocusRef.current = true;
      setPhase('closed');
    }, EXIT_MS);

    return () => {
      window.clearTimeout(closeTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'closed' || !shouldRestoreFocusRef.current) {
      return;
    }

    shouldRestoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      const scrollContainer = getModalScrollContainer(event.target);

      if (canScroll(scrollContainer, event.deltaY)) {
        return;
      }

      event.preventDefault();
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      touchStartRef.current = {
        scrollContainer: getModalScrollContainer(event.target),
        y: touch.clientY,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      const touchStart = touchStartRef.current;

      if (!touch || !touchStart) {
        event.preventDefault();
        return;
      }

      const deltaY = touchStart.y - touch.clientY;

      if (canScroll(touchStart.scrollContainer, deltaY)) {
        return;
      }

      event.preventDefault();
    };

    document.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    });
    document.addEventListener('touchstart', handleTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener('touchmove', handleTouchMove, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
      document.removeEventListener('touchstart', handleTouchStart, {
        capture: true,
      });
      document.removeEventListener('touchmove', handleTouchMove, {
        capture: true,
      });
      touchStartRef.current = null;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }

      if (SCROLL_LOCK_KEYS.has(event.key)) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (closeButtonRef.current?.getClientRects().length) {
      closeButtonRef.current.focus();
    } else {
      panelRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, isVisible]);

  const content =
    typeof children === 'function' ? children({ close }) : children;

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isVisible}
        aria-label={triggerAriaLabel}
        className={triggerClassName}
        style={triggerStyle}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          event.preventDefault();
          open();
        }}
      >
        {trigger}
      </div>

      {isVisible
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto px-3 py-6 sm:px-4 md:py-8"
              data-modal-root
              data-modal-state={isClosing ? 'closing' : 'open'}
              role="dialog"
              aria-modal="true"
              aria-label={modalAriaLabel}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                tabIndex={-1}
                data-modal-overlay
                data-modal-state={isClosing ? 'closing' : 'open'}
                className="will-change-opacity absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
                aria-label="Close modal"
                onClick={(event) => {
                  event.stopPropagation();
                  close();
                }}
              />

              <div
                ref={panelRef}
                data-modal-panel
                data-modal-state={isClosing ? 'closing' : 'open'}
                tabIndex={-1}
                className={joinClasses(
                  'bg-panel border-line relative z-10 flex max-h-[calc(100svh-7rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border shadow-[0_28px_90px_rgba(15,23,42,0.24)] sm:max-h-[90svh] md:max-h-[88vh] md:max-w-3xl',
                  className,
                )}
              >
                <div className="border-line hidden min-w-0 items-center justify-between gap-4 border-b px-5 py-4 sm:flex">
                  <h2 className="text-foreground min-w-0 flex-1 text-lg leading-tight font-semibold">
                    {title}
                  </h2>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                    }}
                    className="text-muted hover:bg-panel-soft hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus:outline-none active:translate-y-px active:scale-95"
                    aria-label="Close modal"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div
                  data-modal-scroll
                  className="text-muted min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-6"
                >
                  {content}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function getModalScrollContainer(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>('[data-modal-scroll]');
}

function canScroll(scrollContainer: HTMLElement | null, deltaY: number) {
  if (!scrollContainer) {
    return false;
  }

  const { clientHeight, scrollHeight, scrollTop } = scrollContainer;

  if (scrollHeight <= clientHeight) {
    return false;
  }

  if (deltaY < 0) {
    return scrollTop > 0;
  }

  if (deltaY > 0) {
    return scrollTop + clientHeight < scrollHeight;
  }

  return false;
}
