import { useState, type ChangeEvent, type ReactNode } from 'react';
import { getDeviceLabel } from '@/utils/devices';
import type { AudioDevice, SectionSignalState } from '@/utils/types';
import { clamp, joinClasses } from '@/utils/utils';
import type { IconComponent, SectionAccent } from './componentTypes';
import {
  HelpTarget,
  HelpTip,
  useHelpMode,
  type HelpTipPlacement,
} from './HelpMode';
import { ChevronDownIcon, RefreshIcon } from './icons';

export function SectionShell({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  const { isHelpModeActive } = useHelpMode();

  return (
    <section
      data-io-section="true"
      data-io-section-muted={muted ? 'true' : undefined}
      data-help-boundary="true"
      className={joinClasses(
        'border-line bg-panel relative overflow-visible rounded-none border-y shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:rounded-lg sm:border',
        !isHelpModeActive && 'sm:overflow-hidden',
      )}
    >
      {children}
      <div
        aria-hidden="true"
        className={joinClasses(
          'pointer-events-none absolute inset-0 z-[45] bg-slate-200/35 backdrop-grayscale transition-opacity duration-300 ease-out',
          muted ? 'opacity-100' : 'opacity-0',
        )}
      />
    </section>
  );
}

export function StickyIoChrome({ children }: { children: ReactNode }) {
  const { isHelpModeActive } = useHelpMode();
  const isSticky = !isHelpModeActive;

  return (
    <div
      className={joinClasses(
        'transition-[margin] duration-200 ease-out',
        'shadow-[0_2px_8px_rgba(15,23,42,0.14)] sm:shadow-none',
        isSticky &&
          'mobile-safe-area-sticky-top sticky z-[35] sm:static sm:z-auto',
      )}
    >
      <div
        className={joinClasses(
          isHelpModeActive ? 'overflow-visible' : 'overflow-hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SectionHeader({
  accent,
  devices,
  deviceKind,
  disabled,
  emptyLabel,
  icon: Icon,
  muted,
  onDeviceChange,
  onRefresh,
  onToggleMute,
  selectedDeviceId,
  selectedDeviceName,
  selectLabel,
  isRecording,
  signalLevel,
  signalState,
  toggleLabel,
}: {
  accent: SectionAccent;
  devices: AudioDevice[];
  deviceKind: 'audioinput' | 'audiooutput';
  disabled?: boolean;
  emptyLabel: string;
  icon: IconComponent;
  muted: boolean;
  onDeviceChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onRefresh: () => void;
  onToggleMute: () => void;
  selectedDeviceId: string;
  selectedDeviceName: string;
  selectLabel: string;
  isRecording?: boolean;
  signalLevel: number;
  signalState: SectionSignalState;
  toggleLabel: string;
}) {
  const canChangeDevice = !disabled && devices.length > 0;
  const headerHelpBubbleClassName =
    'px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs';
  const visibleDeviceName = selectedDeviceName || emptyLabel;

  return (
    <div
      className={joinClasses(
        'border-line grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 border-b px-4 py-4 transition-[margin] duration-200 ease-out sm:px-5',
        accent === 'input' && 'bg-input-soft',
        accent === 'output' && 'bg-output-soft',
      )}
    >
      <HeaderHelpTarget
        accent={accent}
        activeClassName="z-[95]"
        className="h-11 w-11 shrink-0"
        highlightClassName="rounded-full"
        label="Mute"
        placement="bottom-start"
        tipClassName="[--help-tip-gap:0.25rem]"
      >
        <button
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={onToggleMute}
          className={joinClasses(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-white transition focus:outline-none active:translate-y-px active:scale-95',
            muted
              ? 'border-line bg-muted/55'
              : accent === 'input'
                ? 'border-input bg-input hover:bg-input/90'
                : 'border-output bg-output hover:bg-output/90',
          )}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </button>
      </HeaderHelpTarget>
      <HeaderHelpTarget
        accent={accent}
        activeClassName="z-[95]"
        bubbleClassName={joinClasses(
          headerHelpBubbleClassName,
          'whitespace-nowrap',
        )}
        className="max-w-full min-w-0 justify-self-start sm:min-w-44"
        label="Devices"
        placement="bottom-start"
        tipClassName="ml-8 [--help-tip-gap:0.25rem]"
      >
        <label className="relative inline-flex max-w-full min-w-0 items-center justify-self-start py-1 pr-10 text-left">
          <span className="sr-only">{selectLabel}</span>
          <span
            data-help-anchor="true"
            className="text-foreground min-w-0 truncate text-lg leading-tight font-semibold sm:text-xl"
            title={visibleDeviceName}
          >
            {visibleDeviceName}
          </span>
          {canChangeDevice ? (
            <ChevronDownIcon
              aria-hidden="true"
              className="text-muted pointer-events-none mr-2 ml-1.5 h-4 w-4 shrink-0"
            />
          ) : null}
          <select
            id={`${deviceKind}-device`}
            name={`${deviceKind}-device`}
            aria-label={selectLabel}
            disabled={!canChangeDevice}
            title={visibleDeviceName}
            value={selectedDeviceId}
            onChange={onDeviceChange}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-not-allowed"
          >
            {devices.length === 0 ? (
              <option value="">{emptyLabel}</option>
            ) : (
              devices.map((device, index) => (
                <option
                  key={`${device.deviceId}-${index}`}
                  value={device.deviceId}
                >
                  {getDeviceLabel(device, devices, deviceKind)}
                </option>
              ))
            )}
          </select>
        </label>
      </HeaderHelpTarget>

      <HeaderHelpTarget
        accent={accent}
        activeClassName="z-[95]"
        bubbleClassName={joinClasses(
          headerHelpBubbleClassName,
          'whitespace-nowrap',
        )}
        label={
          <>
            <span className="sm:hidden">Refresh</span>
            <span className="hidden sm:inline">Refresh devices</span>
          </>
        }
        placement="bottom-end"
        tipClassName="[--help-tip-gap:0.25rem]"
      >
        <RefreshButton
          accent={accent}
          label="Refresh devices"
          onClick={onRefresh}
          icon={RefreshIcon}
        />
      </HeaderHelpTarget>
      <SignalDot
        isRecording={isRecording}
        level={signalLevel}
        state={signalState}
      />
    </div>
  );
}

function HeaderHelpTarget({
  accent,
  activeClassName,
  bubbleClassName,
  children,
  className,
  highlightClassName,
  label,
  placement,
  tipClassName,
}: {
  accent: SectionAccent;
  activeClassName?: string;
  bubbleClassName?: string;
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  label: ReactNode;
  placement: HelpTipPlacement;
  tipClassName?: string;
}) {
  if (accent !== 'input') {
    return (
      <HelpTarget
        activeClassName={activeClassName}
        className={className}
        highlightClassName={highlightClassName}
      >
        {children}
      </HelpTarget>
    );
  }

  return (
    <HelpTip
      activeClassName={activeClassName}
      bubbleClassName={bubbleClassName}
      className={className}
      highlightClassName={highlightClassName}
      label={label}
      layout="overlay"
      placement={placement}
      tipClassName={tipClassName}
    >
      {children}
    </HelpTip>
  );
}

function SignalDot({
  isRecording,
  level,
  state,
}: {
  isRecording?: boolean;
  level: number;
  state: SectionSignalState;
}) {
  const label = isRecording
    ? 'Recording'
    : state === 'off'
      ? 'Off'
      : state === 'ready'
        ? 'Ready'
        : 'Signal detected';
  const boundedLevel = clamp(level, 0, 1);
  const activeGlowOpacity = 0.14 + boundedLevel * 0.22;
  const activeGlowScale = 1 + boundedLevel * 0.65;
  const isRecordingActive = isRecording === true;

  return (
    <span
      aria-label={label}
      title={label}
      className={joinClasses(
        'relative flex h-5 w-5 items-center justify-center rounded-full',
        (state !== 'off' || isRecordingActive) &&
          (isRecordingActive
            ? 'drop-shadow-[0_1px_3px_rgba(180,35,24,0.22)]'
            : 'drop-shadow-[0_1px_3px_rgba(36,100,194,0.22)]'),
      )}
    >
      <span
        aria-hidden="true"
        className={joinClasses(
          'absolute aspect-square rounded-full transition-[opacity,transform] duration-150 ease-out',
          isRecordingActive && state !== 'active' && 'h-4 w-4 bg-[#b42318]/12',
          !isRecordingActive && state === 'off' && 'bg-muted/10 h-4 w-4',
          !isRecordingActive &&
            state === 'ready' &&
            'bg-status-ready/12 h-4 w-4',
          state === 'active' &&
            (isRecordingActive ? 'bg-[#b42318]' : 'bg-status-active'),
          state === 'active' && 'h-5 w-5 origin-center transform-gpu',
        )}
        style={
          state === 'active'
            ? {
                opacity: activeGlowOpacity,
                transform: `scale(${activeGlowScale})`,
              }
            : undefined
        }
      />
      <span
        aria-hidden="true"
        className={joinClasses(
          'relative h-3.5 w-3.5 rounded-full border transition-colors duration-150',
          isRecordingActive &&
            'border-[#b42318] bg-[#b42318] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_10px_rgba(180,35,24,0.34)]',
          !isRecordingActive && state === 'off' && 'border-line bg-muted/35',
          !isRecordingActive &&
            state === 'ready' &&
            'border-status-ready/80 bg-status-ready shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_0_3px_rgba(76,121,170,0.12)]',
          !isRecordingActive &&
            state === 'active' &&
            'border-status-active bg-status-active shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_10px_rgba(36,100,194,0.34)]',
        )}
      />
    </span>
  );
}

function RefreshButton({
  accent,
  icon: Icon,
  label,
  onClick,
}: {
  accent: SectionAccent;
  icon: IconComponent;
  label: string;
  onClick: () => Promise<void> | void;
}) {
  const [isSpinning, setIsSpinning] = useState(false);

  async function handleClick() {
    setIsSpinning(true);

    try {
      await onClick();
    } finally {
      window.setTimeout(() => setIsSpinning(false), 500);
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={joinClasses(
        'text-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition focus:outline-none active:translate-y-px active:scale-95',
        accent === 'input' && 'hover:bg-input/8',
        accent === 'output' && 'hover:bg-output/8',
      )}
    >
      <Icon
        aria-hidden="true"
        className={joinClasses('h-4 w-4', isSpinning && 'animate-spin')}
      />
    </button>
  );
}
