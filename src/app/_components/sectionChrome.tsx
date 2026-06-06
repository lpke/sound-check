import { useState, type ChangeEvent, type ReactNode } from 'react';
import { getDeviceLabel } from '@/utils/devices';
import type { AudioDevice, SectionSignalState } from '@/utils/types';
import { clamp, joinClasses } from '@/utils/utils';
import type { IconComponent, SectionAccent } from './componentTypes';
import { HelpTip, useHelpMode } from './HelpMode';
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
      data-help-boundary="true"
      className={joinClasses(
        'border-line bg-panel relative overflow-visible rounded-none border-y shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:rounded-lg sm:border',
        !isHelpModeActive && 'sm:overflow-hidden',
      )}
    >
      {children}
      {muted ? (
        <div className="pointer-events-none absolute inset-0 z-20 bg-slate-200/35 backdrop-grayscale" />
      ) : null}
    </section>
  );
}

export function StickyIoChrome({ children }: { children: ReactNode }) {
  const { isHelpModeActive } = useHelpMode();

  return (
    <div
      className={joinClasses(
        'transition-[margin] duration-200 ease-out',
        !isHelpModeActive &&
          'mobile-safe-area-sticky-top sticky z-[35] sm:static sm:z-auto',
      )}
    >
      <div className="overflow-hidden">{children}</div>
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
  signalLevel: number;
  signalState: SectionSignalState;
  toggleLabel: string;
}) {
  const { isHelpModeActive } = useHelpMode();
  const canChangeDevice = !disabled && devices.length > 0;
  const visibleDeviceName = selectedDeviceName || emptyLabel;

  return (
    <div
      className={joinClasses(
        'border-line grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 border-b px-4 py-4 transition-[margin] duration-200 ease-out sm:px-5',
        accent === 'input' && 'bg-input-soft',
        accent === 'output' && 'bg-output-soft',
        isHelpModeActive && accent === 'input' && 'mb-10',
      )}
    >
      <HelpTip
        activeClassName="z-[70]"
        className="h-11 w-11 shrink-0"
        highlightClassName="rounded-full"
        label={accent === 'input' ? 'Mute input' : 'Mute output'}
        lockedPlacement
        placement="bottom"
        showBubble={accent === 'input'}
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
      </HelpTip>
      <HelpTip
        activeClassName="z-[70]"
        bubbleClassName="whitespace-nowrap"
        label="Click for more devices"
        placement="bottom-start"
        showBubble={accent === 'input'}
        className="max-w-full min-w-44 justify-self-start"
      >
        <label className="relative inline-flex items-center justify-self-start py-1 pr-10 text-left">
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
      </HelpTip>

      <HelpTip
        label="Refresh device list"
        lockedPlacement
        placement="bottom"
        showBubble={accent === 'input'}
      >
        <RefreshButton
          accent={accent}
          label="Refresh devices"
          onClick={onRefresh}
          icon={RefreshIcon}
        />
      </HelpTip>
      <SignalDot level={signalLevel} state={signalState} />
    </div>
  );
}

function SignalDot({
  level,
  state,
}: {
  level: number;
  state: SectionSignalState;
}) {
  const label =
    state === 'off' ? 'Off' : state === 'ready' ? 'Ready' : 'Signal detected';
  const boundedLevel = clamp(level, 0, 1);
  const activeGlowOpacity = 0.14 + boundedLevel * 0.22;
  const activeGlowScale = 1 + boundedLevel * 0.65;

  return (
    <span
      aria-label={label}
      title={label}
      className={joinClasses(
        'relative flex h-5 w-5 items-center justify-center rounded-full',
        state !== 'off' && 'drop-shadow-[0_1px_3px_rgba(36,100,194,0.22)]',
      )}
    >
      <span
        aria-hidden="true"
        className={joinClasses(
          'absolute aspect-square rounded-full transition-[opacity,transform] duration-150 ease-out',
          state === 'off' && 'bg-muted/10 h-4 w-4',
          state === 'ready' && 'bg-status-ready/12 h-4 w-4',
          state === 'active' &&
            'bg-status-active h-5 w-5 origin-center transform-gpu',
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
          state === 'off' && 'border-line bg-muted/35',
          state === 'ready' &&
            'border-status-ready/80 bg-status-ready shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_0_3px_rgba(76,121,170,0.12)]',
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
