import type { PointerEvent, ReactNode } from 'react';
import { clamp, formatSeconds, joinClasses } from '@/utils/utils';
import { rangeClassName } from './controlStyles';
import { PauseIcon, PlayIcon, SpinnerIcon } from './Icons';

export function PlaybackIconButton({
  children,
  disabled,
  label,
  onClick,
  onPointerDown,
  className,
  tone,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  className?: string;
  tone: 'danger' | 'mutedOutput' | 'output';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={joinClasses(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent transition focus:outline-none active:translate-y-px active:scale-95 disabled:opacity-35 disabled:active:translate-y-0 disabled:active:scale-100',
        className,
        tone === 'output' && 'text-output hover:bg-output/8 hover:text-output',
        tone === 'mutedOutput' &&
          'text-muted hover:bg-output/8 hover:text-output',
        tone === 'danger' && 'text-muted hover:bg-danger/8 hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}

export function AudioPlaybackControls({
  buttonLabel,
  canUseTransport,
  centerControls,
  children,
  durationContent,
  durationSeconds,
  isLoading = false,
  isPlaying,
  loadingProgressPercent = null,
  markers = [],
  onSeek,
  onToggle,
  positionSeconds,
  seekLabel,
  seekName,
  sideControls,
}: {
  buttonLabel: string;
  canUseTransport: boolean;
  centerControls?: ReactNode;
  children?: ReactNode;
  durationContent?: ReactNode;
  durationSeconds: number;
  isLoading?: boolean;
  isPlaying: boolean;
  loadingProgressPercent?: number | null;
  markers?: {
    id: string;
    label: string;
    seconds: number;
  }[];
  onSeek: (positionSeconds: number) => void;
  onToggle: () => void;
  positionSeconds: number;
  seekLabel: string;
  seekName: string;
  sideControls?: ReactNode;
}) {
  const hasDuration = durationSeconds > 0;
  const boundedPosition = hasDuration
    ? clamp(positionSeconds, 0, durationSeconds)
    : 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6">
      <button
        type="button"
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={onToggle}
        disabled={!canUseTransport || isLoading}
        className={joinClasses(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition focus:outline-none active:translate-y-px active:scale-95 disabled:opacity-45 disabled:active:translate-y-0 disabled:active:scale-100',
          'relative top-[3px]',
          isLoading && 'bg-muted/55 text-white disabled:opacity-100',
          !isLoading &&
            (isPlaying ? 'bg-danger text-white' : 'bg-output text-on-control'),
        )}
      >
        {isLoading && loadingProgressPercent !== null ? (
          <ProgressCircle
            className="h-5 w-5"
            percent={loadingProgressPercent}
          />
        ) : isLoading ? (
          <SpinnerIcon aria-hidden="true" className="h-6 w-6 animate-spin" />
        ) : isPlaying ? (
          <PauseIcon aria-hidden="true" className="h-5 w-5" />
        ) : (
          <PlayIcon aria-hidden="true" className="h-5 w-5 translate-x-px" />
        )}
      </button>

      <div className="grid min-w-0 gap-0">
        {children}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="grid min-w-0 gap-0">
            <div className="relative pb-0">
              <input
                id={seekName}
                name={seekName}
                aria-label={seekLabel}
                type="range"
                min={0}
                max={durationSeconds || 1}
                step={0.05}
                value={boundedPosition}
                disabled={!hasDuration}
                onChange={(event) => onSeek(Number(event.target.value))}
                className={joinClasses(rangeClassName('output'), '-mb-3')}
              />
              {hasDuration
                ? markers.map((marker) => {
                    const markerPercent = clamp(
                      (marker.seconds / durationSeconds) * 100,
                      0,
                      100,
                    );

                    return (
                      <span
                        key={marker.id}
                        aria-hidden="true"
                        title={marker.label}
                        className="bg-output pointer-events-none absolute top-7 z-10 h-2.5 w-px rounded-full"
                        style={{
                          left: `${markerPercent}%`,
                          transform: 'translateX(-50%)',
                        }}
                      />
                    );
                  })
                : null}
            </div>
            <div className="text-muted -mt-3 flex items-center justify-between gap-2 text-xs font-semibold">
              <div className="inline-flex items-center gap-0">
                {centerControls}
                <span
                  className="w-16 shrink-0 font-mono"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatSeconds(boundedPosition)}
                </span>
              </div>
              {durationContent ? (
                <span className="relative inline-flex h-4 w-16 shrink-0 items-center justify-end">
                  <span
                    aria-hidden="true"
                    className="invisible font-mono"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    --:--.-
                  </span>
                  <span className="absolute top-1/2 right-0 z-20 -translate-y-1/2">
                    {durationContent}
                  </span>
                </span>
              ) : (
                <span
                  className="font-mono"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {hasDuration ? formatSeconds(durationSeconds) : '--:--.-'}
                </span>
              )}
            </div>
          </div>
          {sideControls ? (
            <div className="flex items-center justify-end gap-1">
              {sideControls}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressCircle({
  className,
  percent,
}: {
  className?: string;
  percent: number;
}) {
  const radius = 8.5;
  const circumference = 2 * Math.PI * radius;
  const boundedPercent = clamp(percent, 0, 100);
  const strokeDashoffset = circumference * (1 - boundedPercent / 100);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r={radius}
        className="stroke-white/30"
        strokeWidth="2.5"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        className="stroke-current"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        strokeWidth="2.5"
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}
