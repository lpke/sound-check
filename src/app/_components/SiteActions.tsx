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
  const { closeHelpMode, isHelpModeActive } = useHelpMode();

  return (
    <div
      className={joinClasses(
        'flex w-full items-center justify-between gap-2 px-4 sm:fixed sm:right-6 sm:bottom-6 sm:z-[75] sm:w-auto sm:justify-end sm:px-0',
        isHelpModeActive &&
          'border-line/80 bg-background/92 sticky top-0 z-[85] py-3 shadow-[0_12px_26px_rgba(15,23,42,0.12)] sm:top-auto sm:border-0 sm:bg-transparent sm:py-0 sm:shadow-none',
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
          closeWhen={isHelpModeActive}
          soundCheck={soundCheck}
          onOpen={closeHelpMode}
        />
      </div>
    </div>
  );
}
