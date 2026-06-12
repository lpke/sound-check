import type { CSSProperties, ReactNode } from 'react';
import { joinClasses } from '@/utils/utils';
import { useHelpMode } from '@/hooks/useHelpMode';
import { HelpTip } from './HelpMode';

export function SettingsGroup({
  animateDescription = false,
  children,
  className,
  description,
  helpDescription,
  style,
  title,
  titleAction,
}: {
  animateDescription?: boolean;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  helpDescription?: string;
  style?: CSSProperties;
  title?: string;
  titleAction?: ReactNode;
}) {
  const { isHelpModeActive, isHelpModeExiting } = useHelpMode();
  const hasHelpDescription = Boolean(helpDescription);
  const isHelpModeOpen = isHelpModeActive && !isHelpModeExiting;
  const hasHeader = Boolean(title || description || titleAction);
  const hasTitleRow = Boolean(title || titleAction);
  const shouldRenderDescription = animateDescription || description;
  const group = (
    <section
      data-help-anchor={hasHelpDescription ? 'true' : undefined}
      style={style}
      className={joinClasses(
        'border-line bg-panel-soft rounded-lg border p-4 transition-colors duration-200 ease-out',
        isHelpModeOpen && hasHelpDescription && 'border-help-warning/45',
        className,
      )}
    >
      {hasHeader ? (
        <div className="mb-4">
          {hasTitleRow ? (
            <div className="flex min-w-0 items-center gap-3">
              {title ? (
                <h2 className="text-foreground min-w-0 text-sm font-semibold">
                  {title}
                </h2>
              ) : null}
              {titleAction ? (
                <div className="settings-group-title-action ml-auto shrink-0">
                  {titleAction}
                </div>
              ) : null}
            </div>
          ) : null}
          {shouldRenderDescription ? (
            <SettingsGroupDescription
              visible={Boolean(description)}
              withTitleGap={hasTitleRow}
            >
              {description}
            </SettingsGroupDescription>
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
      className="block"
      label={helpDescription}
      placement="top-start"
      tipClassName="max-w-[min(18rem,calc(100vw-2rem))]"
    >
      {group}
    </HelpTip>
  );
}

export function SettingsGroupDescription({
  children,
  visible = Boolean(children),
  withTitleGap = true,
}: {
  children: ReactNode;
  visible?: boolean;
  withTitleGap?: boolean;
}) {
  return (
    <div
      data-settings-group-description="true"
      className={joinClasses(
        'grid overflow-hidden transition-[grid-template-rows,margin-top] duration-200 ease-out',
        visible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        withTitleGap && (visible ? 'mt-1' : 'mt-0'),
      )}
    >
      <p
        className={joinClasses(
          'text-muted min-h-0 text-xs leading-5 transition-[opacity,transform] duration-200 ease-out',
          visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
        )}
      >
        {children}
      </p>
    </div>
  );
}
