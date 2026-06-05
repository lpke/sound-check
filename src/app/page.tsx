'use client';

import {
  AppHeader,
  DevicePanel,
  InputProcessingPanel,
  MonitorPanel,
  RecordingPanel,
  SessionStatusPanel,
  SpeakerTestPanel,
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
            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <DevicePanel soundCheck={controller} />
              <InputProcessingPanel soundCheck={controller} />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <SpeakerTestPanel soundCheck={controller} />
              <MonitorPanel soundCheck={controller} />
              <RecordingPanel soundCheck={controller} />
            </section>

            <SessionStatusPanel soundCheck={controller} />
          </>
        )}
      </div>
    </main>
  );
}
