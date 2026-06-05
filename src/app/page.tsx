'use client';

import {
  InputSection,
  OutputSection,
  SiteHeader,
  UnsupportedPanel,
} from '@/components/panels';
import { useSoundCheck } from '@/utils/useSoundCheck';

export default function HomePage() {
  const { audioRef, controller } = useSoundCheck();

  return (
    <main className="bg-background text-foreground min-h-screen">
      <audio ref={audioRef} className="hidden" playsInline />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <SiteHeader soundCheck={controller} />

        {!controller.isSupported ? (
          <UnsupportedPanel />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <InputSection soundCheck={controller} />
              <OutputSection soundCheck={controller} />
            </section>
            <div className="flex justify-start pt-2">
              <button
                type="button"
                onClick={controller.requestPermissionSync}
                className="text-muted/70 hover:text-muted text-sm underline underline-offset-2 transition focus:outline-none"
              >
                Recheck permission and refresh devices
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
