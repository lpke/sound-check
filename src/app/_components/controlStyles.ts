import type { SectionAccent } from './componentTypes';
import { joinClasses } from '@/utils/utils';

export function controlClassName(accent: SectionAccent) {
  return joinClasses(
    'border-line bg-panel text-foreground h-11 w-full rounded-lg border px-3 pr-10 text-sm transition outline-none focus:ring-4 appearance-none',
    accent === 'input' && 'focus:border-input focus:ring-input-soft',
    accent === 'output' && 'focus:border-output focus:ring-output-soft',
  );
}

export function numberInputClassName(accent: SectionAccent) {
  return joinClasses(
    controlClassName(accent),
    'rounded-t-lg border-0 border-b-0 font-mono focus:border-0 focus:ring-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:outline-none',
  );
}

export function rangeClassName(accent: SectionAccent) {
  return joinClasses(
    'h-11 w-full rounded-lg outline-none focus-visible:ring-4',
    accent === 'input' && 'accent-input focus-visible:ring-input-soft',
    accent === 'output' && 'accent-output focus-visible:ring-output-soft',
  );
}

export function checkboxClassName(accent: SectionAccent, className: string) {
  return joinClasses(
    className,
    accent === 'input' && 'accent-input',
    accent === 'output' && 'accent-output',
  );
}
