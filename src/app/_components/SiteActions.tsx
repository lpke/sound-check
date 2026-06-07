import type { ReactNode } from 'react';
import type { SoundCheckController } from '@/utils/useSoundCheck';
import { joinClasses } from '@/utils/utils';
import { DebugModal } from './DebugModal';
import { HelpModeButton, useHelpMode } from './HelpMode';
import { siteActionButtonClassName } from './siteActionStyles';

export function SiteActions({
  soundCheck,
}: {
  soundCheck: SoundCheckController;
}) {
  const { closeHelpMode, isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const shouldCloseDebugForHelp = isHelpModeActive && !isHelpModeExiting;

  return (
    <SiteHeaderArea isSticky={isHelpModeActive}>
      <div className="flex w-full items-center justify-between gap-2 sm:fixed sm:right-6 sm:bottom-6 sm:z-[110] sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={soundCheck.toggleAllAudio}
          className={siteActionButtonClassName({
            fontWeight: 'semibold',
            tone: soundCheck.allAudioStopped ? 'control' : 'default',
            widthClassName: 'w-28',
          })}
        >
          {soundCheck.allAudioStopped ? 'Resume all' : 'Pause all'}
        </button>
        <div className="flex items-center gap-2">
          <HelpModeButton />
          <DebugModal
            closeWhen={shouldCloseDebugForHelp}
            soundCheck={soundCheck}
            onOpen={closeHelpMode}
          />
        </div>
      </div>
    </SiteHeaderArea>
  );
}

function SiteHeaderArea({
  children,
  isSticky,
}: {
  children: ReactNode;
  isSticky: boolean;
}) {
  return (
    <div
      className={joinClasses(
        'px-4 py-4 sm:contents',
        isSticky &&
          'mobile-safe-area-sticky-top bg-background sticky z-[110] shadow-[0_2px_8px_rgba(15,23,42,0.16)] sm:static sm:bg-transparent sm:shadow-none',
      )}
    >
      {children}
    </div>
  );
}
