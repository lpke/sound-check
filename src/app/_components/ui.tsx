import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StatusTone } from '@/utils/types';
import { clamp, joinClasses } from '@/utils/utils';

export function Panel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="border-line bg-panel rounded-lg border p-4 shadow-sm sm:p-5">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-foreground mb-2 block text-sm font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Button({
  children,
  disabled,
  onClick,
  variant = 'primary',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?:
    | 'danger'
    | 'outputPrimary'
    | 'outputSecondary'
    | 'primary'
    | 'secondary';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        'inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition focus:outline-none active:translate-y-px active:scale-[0.985] disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100',
        variant === 'primary' &&
          'border-control bg-control text-on-control hover:bg-control-hover',
        variant === 'secondary' &&
          'border-line bg-panel-soft text-foreground hover:bg-panel-strong',
        variant === 'outputPrimary' &&
          'border-output bg-output text-on-control hover:bg-output/90',
        variant === 'outputSecondary' &&
          'border-output/25 bg-output-soft text-output hover:border-output/35 hover:bg-output-soft/70',
        variant === 'danger' &&
          'border-danger bg-danger hover:bg-danger/90 text-white',
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  description,
  disabled,
  id,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  id: string;
  label: string;
  name?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="border-line bg-panel-soft flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4">
      <span>
        <span className="text-foreground block text-sm font-semibold">
          {label}
        </span>
        <span className="text-muted mt-1 block text-xs leading-5">
          {description}
        </span>
      </span>
      <input
        id={id}
        name={name ?? id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-control h-5 w-5 shrink-0"
      />
    </label>
  );
}

export function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: StatusTone;
}) {
  return (
    <span
      className={joinClasses(
        'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold',
        tone === 'good' && 'border-signal/30 bg-signal-soft text-signal',
        tone === 'warn' && 'border-warning/30 bg-warning-soft text-warning',
        tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
        tone === 'idle' && 'border-line bg-panel-soft text-muted',
      )}
    >
      {children}
    </span>
  );
}

export function LevelMeter({
  accent = 'control',
  className,
  level,
}: {
  accent?: 'control' | 'input' | 'output';
  className?: string;
  level: number;
}) {
  const boundedLevel = clamp(level, 0, 1);
  const [peakLevel, setPeakLevel] = useState(0);
  const [isPeakVisible, setIsPeakVisible] = useState(false);
  const latestLevelRef = useRef(boundedLevel);
  const fadeTimerRef = useRef<number | null>(null);
  const dropTimerRef = useRef<number | null>(null);
  const segments = Array.from({ length: 48 }, (_, index) => index);
  const activeSegments = Math.round(boundedLevel * segments.length);
  const peakSegment = Math.max(0, Math.ceil(peakLevel * segments.length) - 1);

  useEffect(() => {
    latestLevelRef.current = boundedLevel;
  }, [boundedLevel]);

  useEffect(() => {
    if (boundedLevel <= peakLevel) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }

      if (dropTimerRef.current !== null) {
        window.clearTimeout(dropTimerRef.current);
      }

      setPeakLevel(boundedLevel);
      setIsPeakVisible(boundedLevel > 0);

      fadeTimerRef.current = window.setTimeout(() => {
        setIsPeakVisible(false);
      }, 1000);
      dropTimerRef.current = window.setTimeout(() => {
        setPeakLevel(latestLevelRef.current);
      }, 1350);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [boundedLevel, peakLevel]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }

      if (dropTimerRef.current !== null) {
        window.clearTimeout(dropTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={joinClasses(
        'bg-panel-strong grid h-3 grid-cols-[repeat(48,minmax(0,1fr))] overflow-hidden',
        className,
      )}
    >
      {segments.map((segment) => {
        const isActive = segment < activeSegments;
        const isPeak = peakLevel > 0 && segment === peakSegment;
        const ratio = (segment + 1) / segments.length;

        return (
          <span
            key={segment}
            className={joinClasses(
              'relative h-full min-w-0',
              isActive && ratio <= 0.76 && accent === 'output' && 'bg-output',
              isActive && ratio <= 0.76 && accent !== 'output' && 'bg-input',
              isActive && ratio > 0.76 && ratio <= 0.9 && 'bg-warning',
              isActive && ratio > 0.9 && 'bg-danger',
              isActive &&
                segment < activeSegments - 1 &&
                'after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-white/35',
              isPeak &&
                'before:bg-foreground/70 before:absolute before:top-0 before:right-0 before:z-10 before:h-full before:w-0.5 before:transition-opacity before:duration-300',
              isPeak &&
                (isPeakVisible ? 'before:opacity-100' : 'before:opacity-0'),
            )}
          />
        );
      })}
    </div>
  );
}
