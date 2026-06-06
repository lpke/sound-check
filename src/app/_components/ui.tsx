import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StatusTone } from '@/utils/types';
import { clamp, joinClasses } from '@/utils/utils';
import { HelpTip, useHelpMode } from './HelpMode';

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
  title,
  onClick,
  className,
  variant = 'primary',
}: {
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  className?: string;
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
      title={title}
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
        className,
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

const LEVEL_METER_SEGMENT_COUNT = 48;
const SIMPLE_LEVEL_METER_HEIGHT_QUERY = '(max-height: 549px)';

export function LevelMeter({
  accent = 'control',
  className,
  level,
  spectrum = [],
  spectrumPeaks = [],
}: {
  accent?: 'control' | 'input' | 'output';
  className?: string;
  level: number;
  spectrum?: readonly number[];
  spectrumPeaks?: readonly number[];
}) {
  const boundedLevel = clamp(level, 0, 1);
  const [peakLevel, setPeakLevel] = useState(0);
  const [isPeakVisible, setIsPeakVisible] = useState(false);
  const [hasSimpleHelpBubbleSettled, setHasSimpleHelpBubbleSettled] =
    useState(false);
  const [isSpectrumVisible, setIsSpectrumVisible] = useState(
    getDefaultIsSpectrumVisible,
  );
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const latestLevelRef = useRef(boundedLevel);
  const fadeTimerRef = useRef<number | null>(null);
  const dropTimerRef = useRef<number | null>(null);
  const segments = Array.from(
    { length: LEVEL_METER_SEGMENT_COUNT },
    (_, index) => index,
  );
  const activeSegments = Math.round(boundedLevel * segments.length);
  const peakSegment = Math.max(0, Math.ceil(peakLevel * segments.length) - 1);
  const visualizerLevels = useMemo(
    () => normalizeSpectrumLevels(spectrum, LEVEL_METER_SEGMENT_COUNT),
    [spectrum],
  );
  const visualizerPeakLevels = useMemo(
    () => normalizeSpectrumLevels(spectrumPeaks, LEVEL_METER_SEGMENT_COUNT),
    [spectrumPeaks],
  );
  const toggleLabel = isSpectrumVisible
    ? 'Show simple level meter'
    : 'Show frequency visualizer';

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

  useEffect(() => {
    if (!isHelpModeActive || isSpectrumVisible || accent !== 'input') {
      const resetTimer = window.setTimeout(() => {
        setHasSimpleHelpBubbleSettled(false);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    if (isHelpModeExiting) {
      return undefined;
    }

    const showBubbleTimer = window.setTimeout(() => {
      setHasSimpleHelpBubbleSettled(true);
    }, 340);

    return () => window.clearTimeout(showBubbleTimer);
  }, [accent, isHelpModeActive, isHelpModeExiting, isSpectrumVisible]);
  const canShowSimpleHelpBubble =
    isHelpModeActive &&
    !isSpectrumVisible &&
    accent === 'input' &&
    hasSimpleHelpBubbleSettled;

  const meterButton = (
    <button
      type="button"
      aria-label={toggleLabel}
      aria-pressed={isSpectrumVisible}
      title={toggleLabel}
      onClick={() => setIsSpectrumVisible((current) => !current)}
      className={joinClasses(
        'bg-panel-strong focus-visible:ring-control-soft relative block w-full overflow-hidden p-0 text-left transition-[height,background-color,box-shadow] duration-300 ease-out focus-visible:ring-2 focus-visible:outline-none',
        isSpectrumVisible
          ? 'h-20 shadow-[inset_0_0_0_1px_rgba(23,26,31,0.08),inset_0_12px_28px_rgba(23,26,31,0.08)]'
          : 'grid h-3 grid-cols-[repeat(48,minmax(0,1fr))]',
        className,
      )}
    >
      {isSpectrumVisible ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.65) 1px, transparent 1px), linear-gradient(to top, rgba(23,26,31,0.16) 1px, transparent 1px)',
              backgroundSize: '12.5% 100%, 100% 25%',
            }}
          />
          <span
            aria-hidden="true"
            className="bg-danger absolute inset-x-0 top-0 z-20 h-px opacity-70"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-1 top-2 bottom-1 z-10 flex items-stretch gap-0.5"
          >
            {visualizerLevels.map((visualizerLevel, index) => {
              const peakLevelForBand = clamp(
                visualizerPeakLevels[index] ?? 0,
                0,
                1,
              );

              return (
                <span key={index} className="relative min-w-0 flex-1">
                  <span
                    className={joinClasses(
                      'absolute inset-x-0 bottom-0 rounded-t-sm transition-[height,opacity,background-color] duration-75',
                      meterToneClassName(visualizerLevel, accent),
                    )}
                    style={{
                      height: `${visualizerLevel > 0 ? Math.max(5, visualizerLevel * 100) : 2}%`,
                      opacity: 0.18 + visualizerLevel * 0.82,
                    }}
                  />
                  <span
                    className="bg-foreground/70 absolute inset-x-0 h-px transition-[bottom,opacity] duration-75"
                    style={{
                      bottom: `${peakLevelForBand * 100}%`,
                      opacity: peakLevelForBand > 0 ? 0.72 : 0,
                    }}
                  />
                </span>
              );
            })}
          </span>
          <span
            aria-hidden="true"
            className={joinClasses(
              'pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-gradient-to-t to-transparent',
              accent === 'output'
                ? 'from-output-soft/45'
                : 'from-input-soft/45',
            )}
          />
        </>
      ) : (
        segments.map((segment) => {
          const isActive = segment < activeSegments;
          const isPeak = peakLevel > 0 && segment === peakSegment;
          const ratio = (segment + 1) / segments.length;

          return (
            <span
              key={segment}
              className={joinClasses(
                'relative h-full min-w-0',
                isActive && meterToneClassName(ratio, accent),
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
        })
      )}
    </button>
  );

  const levelMeterWrapperClassName = joinClasses(
    'block w-full transition-[margin] duration-200 ease-out',
    isHelpModeActive && !isSpectrumVisible && accent === 'input' && 'mb-12',
  );

  return (
    <HelpTip
      className={levelMeterWrapperClassName}
      label="Toggle visualiser style"
      lockedPlacement
      placement="bottom"
      showBubble={canShowSimpleHelpBubble}
    >
      {meterButton}
      {isHelpModeActive && isSpectrumVisible && accent === 'input' ? (
        <span className="pointer-events-none absolute bottom-2 left-1/2 z-40 -translate-x-1/2">
          <span
            className={joinClasses(
              'help-tip-bubble block rounded-lg border px-2.5 py-1.5 text-xs leading-4 font-semibold whitespace-nowrap shadow-[0_18px_42px_rgba(15,23,42,0.28)]',
              isHelpModeExiting &&
                'animate-[help-tip-fade-out_160ms_ease-in_both]',
            )}
          >
            Toggle visualiser style
          </span>
        </span>
      ) : null}
    </HelpTip>
  );
}

function getDefaultIsSpectrumVisible() {
  if (typeof window === 'undefined') {
    return true;
  }

  return !window.matchMedia(SIMPLE_LEVEL_METER_HEIGHT_QUERY).matches;
}

function meterToneClassName(
  value: number,
  accent: 'control' | 'input' | 'output',
) {
  if (value > 0.9) {
    return 'bg-danger';
  }

  if (value > 0.76) {
    return 'bg-warning';
  }

  return accent === 'output' ? 'bg-output' : 'bg-input';
}

function normalizeSpectrumLevels(
  spectrum: readonly number[],
  segmentCount: number,
) {
  if (spectrum.length === segmentCount) {
    return spectrum.map((level) => clamp(level, 0, 1));
  }

  if (spectrum.length === 0) {
    return Array.from({ length: segmentCount }, () => 0);
  }

  return Array.from({ length: segmentCount }, (_, index) => {
    const startIndex = Math.floor((index / segmentCount) * spectrum.length);
    const endIndex = Math.max(
      startIndex + 1,
      Math.ceil(((index + 1) / segmentCount) * spectrum.length),
    );
    let peak = 0;

    for (
      let spectrumIndex = startIndex;
      spectrumIndex < endIndex && spectrumIndex < spectrum.length;
      spectrumIndex += 1
    ) {
      peak = Math.max(peak, spectrum[spectrumIndex] ?? 0);
    }

    return clamp(peak, 0, 1);
  });
}
