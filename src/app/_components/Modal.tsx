'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { joinClasses } from '@/utils/utils';

const EXIT_MS = 280;
const MODAL_SHEET_MEDIA_QUERY = '(max-height: 760px)';
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
  modalAriaLabel?: string;
  title?: ReactNode;
  trigger: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
};

export function Modal({
  children,
  className,
  modalAriaLabel = 'Modal',
  title,
  trigger,
  triggerAriaLabel = 'Open modal',
  triggerClassName,
  triggerStyle,
}: ModalProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{
    scrollContainer: HTMLElement | null;
    y: number;
  } | null>(null);
  const shouldRestoreFocusRef = useRef(false);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [isSheetModal, setIsSheetModal] = useState(false);
  const isClosing = phase === 'closing';
  const isVisible = phase !== 'closed';

  const open = useCallback(() => {
    setIsSheetModal(getIsSheetModalViewport());
    setPhase('open');
  }, []);

  const close = useCallback(() => {
    setPhase((currentPhase) =>
      currentPhase === 'open' ? 'closing' : currentPhase,
    );
  }, []);

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

    const sheetMediaQuery = window.matchMedia(MODAL_SHEET_MEDIA_QUERY);
    const updateSheetMode = () => setIsSheetModal(sheetMediaQuery.matches);

    updateSheetMode();
    sheetMediaQuery.addEventListener('change', updateSheetMode);

    return () => {
      sheetMediaQuery.removeEventListener('change', updateSheetMode);
    };
  }, [isVisible]);

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
    closeButtonRef.current?.focus();

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
              className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-4 md:py-8"
              data-modal-root
              role="dialog"
              aria-modal="true"
              aria-label={modalAriaLabel}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <style>{`
                @keyframes modalOverlayIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                @keyframes modalOverlayOut {
                  from { opacity: 1; }
                  to { opacity: 0; }
                }
                @keyframes modalSheetIn {
                  from { opacity: 0; transform: translateY(100%); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes modalSheetOut {
                  from { opacity: 1; transform: translateY(0); }
                  to { opacity: 0; transform: translateY(100%); }
                }
                @keyframes modalGrowIn {
                  from { opacity: 0; transform: translateY(10px) scale(0.96); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes modalGrowOut {
                  from { opacity: 1; transform: translateY(0) scale(1); }
                  to { opacity: 0; transform: translateY(8px) scale(0.97); }
                }
                @media ${MODAL_SHEET_MEDIA_QUERY} {
                  [data-modal-root] {
                    align-items: flex-end;
                    padding-bottom: 0;
                  }
                  [data-modal-panel] {
                    border-bottom-right-radius: 0;
                    border-bottom-left-radius: 0;
                  }
                  [data-modal-panel][data-modal-state='open'] {
                    animation-name: modalSheetIn;
                  }
                  [data-modal-panel][data-modal-state='closing'] {
                    animation-name: modalSheetOut;
                  }
                }
              `}</style>
              <button
                type="button"
                tabIndex={-1}
                className={joinClasses(
                  'will-change-opacity absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm',
                  isClosing
                    ? 'animate-[modalOverlayOut_260ms_ease-in_both]'
                    : 'animate-[modalOverlayIn_300ms_ease-out_both]',
                )}
                aria-label="Close modal"
                onClick={(event) => {
                  event.stopPropagation();
                  close();
                }}
              />

              <div
                data-modal-panel
                data-modal-state={isClosing ? 'closing' : 'open'}
                className={joinClasses(
                  'bg-panel border-line relative z-10 flex max-h-[90svh] w-full max-w-3xl transform-gpu flex-col overflow-hidden rounded-lg border shadow-[0_28px_90px_rgba(15,23,42,0.24)] will-change-transform md:max-h-[88vh]',
                  isClosing
                    ? 'animate-[modalGrowOut_220ms_ease-in_both]'
                    : 'animate-[modalGrowIn_260ms_cubic-bezier(0.16,1,0.3,1)_both]',
                  isSheetModal && 'min-h-[50svh]',
                  className,
                )}
              >
                <div className="border-line flex min-w-0 items-center justify-between gap-4 border-b px-5 py-4">
                  <h2 className="text-foreground min-w-0 flex-1 text-xl leading-tight font-semibold">
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

function getIsSheetModalViewport() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(MODAL_SHEET_MEDIA_QUERY).matches;
}
