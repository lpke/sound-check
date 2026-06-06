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
    <div
      className={joinClasses(
        'flex w-full items-center justify-between gap-2 px-4 sm:fixed sm:right-6 sm:bottom-6 sm:z-[110] sm:w-auto sm:justify-end sm:px-0',
        isHelpModeActive &&
          'border-line/80 bg-background mobile-safe-area-sticky-top sticky z-[110] py-4 sm:top-auto sm:border-0 sm:bg-transparent sm:py-0',
      )}
    >
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
  );
}
