import type { SoundCheckController } from '@/utils/useSoundCheck';
import { joinClasses } from '@/utils/utils';
import { DebugModal } from './DebugModal';

export function SiteFooter({
  soundCheck,
  onRecheckPermission,
}: {
  soundCheck: SoundCheckController;
  onRecheckPermission?: () => void;
}) {
  return (
    <footer className="mt-2 flex items-center justify-between gap-2 pb-1">
      <div className="flex-1">
        {onRecheckPermission ? (
          <button
            type="button"
            onClick={onRecheckPermission}
            className="text-muted/70 hover:text-muted text-sm underline underline-offset-2 transition focus:outline-none"
          >
            Recheck permission and refresh devices
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <DebugModal soundCheck={soundCheck} />
        <button
          type="button"
          onClick={soundCheck.toggleAllAudio}
          className={joinClasses(
            'inline-flex h-10 w-28 items-center justify-center rounded-lg border px-3 text-sm font-semibold whitespace-nowrap transition focus:outline-none active:translate-y-px active:scale-[0.985]',
            soundCheck.allAudioStopped
              ? 'border-control bg-control text-on-control hover:bg-control-hover'
              : 'border-line bg-panel text-foreground hover:bg-panel-soft',
          )}
        >
          {soundCheck.allAudioStopped ? 'Resume all' : 'Pause all'}
        </button>
      </div>
    </footer>
  );
}
