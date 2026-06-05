import type { ReactNode } from 'react';
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
      <h2 className="font-headline text-foreground text-lg font-semibold">
        {title}
      </h2>
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
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        'inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition focus:ring-4 focus:outline-none disabled:opacity-50',
        variant === 'primary' &&
          'border-control bg-control text-on-control hover:bg-control-hover focus:ring-control-soft',
        variant === 'secondary' &&
          'border-line bg-panel-soft text-foreground hover:bg-panel-strong focus:ring-control-soft',
        variant === 'danger' &&
          'border-danger bg-danger hover:bg-danger/90 focus:ring-danger-soft text-white',
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

  return (
    <div
      className={joinClasses('bg-panel-strong h-2 overflow-hidden', className)}
    >
      <span
        className={joinClasses(
          'block h-full origin-left transition-transform duration-75',
          accent === 'control' && 'bg-control',
          accent === 'input' && 'bg-input',
          accent === 'output' && 'bg-output',
        )}
        style={{ transform: `scaleX(${boundedLevel})` }}
      />
    </div>
  );
}
