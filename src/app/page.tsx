'use client';

import {
  AppHeader,
  InputLane,
  OutputLane,
  SessionStatusPanel,
  UnsupportedPanel,
} from '@/components/panels';
import { useSoundCheck } from '@/utils/useSoundCheck';

export default function HomePage() {
  const { audioRef, controller } = useSoundCheck();

  return (
    <main className="bg-background text-foreground min-h-screen">
      <audio ref={audioRef} className="hidden" playsInline />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <AppHeader soundCheck={controller} />

        {!controller.isSupported ? (
          <UnsupportedPanel />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <InputLane soundCheck={controller} />
              <OutputLane soundCheck={controller} />
            </section>

            <SessionStatusPanel soundCheck={controller} />
          </>
        )}
      </div>
    </main>
  );
}
