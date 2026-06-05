import type { ReactNode } from 'react';

export function SettingsGroup({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: string;
}) {
  return (
    <section className="border-line bg-panel-soft rounded-lg border p-4">
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
}
