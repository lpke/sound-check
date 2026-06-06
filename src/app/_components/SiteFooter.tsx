import type { SoundCheckController } from '@/utils/useSoundCheck';
import { siteActionButtonClassName } from './siteActionStyles';

export function SiteFooter({
  onRecheckPermission,
}: {
  soundCheck: SoundCheckController;
  onRecheckPermission?: () => void;
}) {
  return (
    <footer className="mt-2 flex items-center justify-start gap-2 px-4 pb-1 sm:px-0">
      {onRecheckPermission ? (
        <button
          type="button"
          onClick={onRecheckPermission}
          className={siteActionButtonClassName({
            className: 'sm:fixed sm:bottom-6 sm:left-6 sm:z-[75]',
          })}
        >
          Recheck permissions and refresh devices
        </button>
      ) : null}
    </footer>
  );
}
