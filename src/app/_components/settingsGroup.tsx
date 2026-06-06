import type { ReactNode } from 'react';
import { joinClasses } from '@/utils/utils';
import { HelpTip, useHelpMode } from './HelpMode';

export function SettingsGroup({
  children,
  description,
  helpDescription,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  helpDescription?: string;
  title?: string;
}) {
  const { isHelpModeActive } = useHelpMode();
  const hasHelpDescription = Boolean(helpDescription);
  const group = (
    <section
      data-help-anchor={hasHelpDescription ? 'true' : undefined}
      className={joinClasses(
        'border-line bg-panel-soft rounded-lg border p-4 transition-colors duration-200 ease-out',
        isHelpModeActive && hasHelpDescription && 'border-help-warning/45',
      )}
    >
      {title || description ? (
        <div className="mb-4">
          {title ? (
            <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-muted mt-1 text-xs leading-5">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );

  if (!hasHelpDescription || !helpDescription) {
    return group;
  }

  return (
    <HelpTip
      activeClassName="z-50"
      bubbleClassName="max-w-[18rem]"
      className={joinClasses(
        'block transition-[padding-top] duration-200 ease-out',
        isHelpModeActive ? 'pt-11' : 'pt-0',
      )}
      label={helpDescription}
      lockedPlacement
      placement="top-start"
      shellClassName="max-w-[min(18rem,calc(100vw-2rem))]"
    >
      {group}
    </HelpTip>
  );
}
