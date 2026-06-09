import { useEffect, useRef, useState, type ReactNode } from 'react';
import { joinClasses } from '@/utils/utils';
import type { SectionAccent } from './componentTypes';
import { WarningIcon, WarningQuestionIcon } from './Icons';
import { Popover } from './Popover';

const WARNING_DISMISSED_EVENT = 'sound-check-warning-dismissed';

export function DeviceWarning({
  accent,
  message,
  storageKey,
  tone,
}: {
  accent: SectionAccent;
  message: ReactNode;
  storageKey: string;
  tone: 'muted' | 'warning';
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const Icon = tone === 'warning' ? WarningIcon : WarningQuestionIcon;
  const [isDismissed, setIsDismissed] = useState(() =>
    isWarningDismissed(storageKey),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function handleWarningDismissed(event: Event) {
      if (
        event instanceof CustomEvent &&
        event.detail?.storageKey === storageKey
      ) {
        setIsDismissed(true);
        setIsOpen(false);
        setAnchorRect(null);
      }
    }

    window.addEventListener(WARNING_DISMISSED_EVENT, handleWarningDismissed);

    return () => {
      window.removeEventListener(
        WARNING_DISMISSED_EVENT,
        handleWarningDismissed,
      );
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        buttonRef.current?.contains(target) ||
        (target instanceof Element &&
          target.closest('[data-sound-check-popover="true"]'))
      ) {
        return;
      }

      setIsOpen(false);
      setAnchorRect(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setAnchorRect(null);
      }
    }

    function updatePopoverPosition() {
      if (!buttonRef.current) {
        return;
      }

      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isOpen]);

  function ignoreWarning() {
    window.sessionStorage.setItem(storageKey, 'true');
    setIsDismissed(true);
    setIsOpen(false);
    setAnchorRect(null);
    window.dispatchEvent(
      new CustomEvent(WARNING_DISMISSED_EVENT, {
        detail: { storageKey },
      }),
    );
  }

  if (isDismissed) {
    return null;
  }

  return (
    <span className="relative z-10 ml-1 flex h-9 w-9 shrink-0 items-center justify-center">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Audio quality warning"
        aria-expanded={isOpen}
        title="Device warning"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isOpen) {
            setIsOpen(false);
            setAnchorRect(null);
            return;
          }

          setAnchorRect(buttonRef.current?.getBoundingClientRect() ?? null);
          setIsOpen(true);
        }}
        className={joinClasses(
          'flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition focus:outline-none active:translate-y-px active:scale-95',
          tone === 'warning' ? 'text-warning' : 'text-muted/70',
          accent === 'input' && 'hover:bg-input/8',
          accent === 'output' && 'hover:bg-output/8',
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </button>
      <Popover anchorRect={anchorRect} isOpen={isOpen}>
        <span className="text-foreground block">{message}</span>
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            ignoreWarning();
          }}
          className="text-warning mt-1 inline underline underline-offset-2"
        >
          Ignore warning
        </button>
      </Popover>
    </span>
  );
}

function isWarningDismissed(storageKey: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.sessionStorage.getItem(storageKey) === 'true';
}
