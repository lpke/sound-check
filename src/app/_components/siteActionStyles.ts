import { joinClasses } from '@/utils/utils';

type SiteActionTone = 'control' | 'danger' | 'default';

export function siteActionButtonClassName({
  className,
  fontWeight = 'normal',
  tone = 'default',
  widthClassName,
}: {
  className?: string;
  fontWeight?: 'normal' | 'semibold';
  tone?: SiteActionTone;
  widthClassName?: string;
}) {
  return joinClasses(
    'inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm whitespace-nowrap transition focus:outline-none active:translate-y-px active:scale-[0.985]',
    fontWeight === 'semibold' ? 'font-semibold' : 'font-normal',
    widthClassName,
    tone === 'control'
      ? 'border-control bg-control text-on-control hover:bg-control-hover'
      : tone === 'danger'
        ? 'border-danger bg-danger hover:bg-danger/90 text-white'
        : 'border-line bg-panel text-foreground hover:bg-panel-soft',
    className,
  );
}
