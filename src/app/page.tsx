'use client';

import { InputSection } from '@/components/InputSection';
import { OutputSection } from '@/components/OutputSection';
import { SiteFooter } from '@/components/SiteFooter';
import { UnsupportedPanel } from '@/components/UnsupportedPanel';
import { useSoundCheck } from '@/utils/useSoundCheck';

export default function HomePage() {
  const { audioRef, monitorAudioRef, recordedPlaybackAudioRef, controller } =
    useSoundCheck();

  return (
    <main className="bg-background text-foreground min-h-screen">
      <audio ref={audioRef} className="hidden" playsInline />
      <audio ref={recordedPlaybackAudioRef} className="hidden" playsInline />
      <audio ref={monitorAudioRef} className="hidden" playsInline />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-5 sm:px-6 lg:px-8">
        {!controller.isSupported ? (
          <UnsupportedPanel />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <InputSection soundCheck={controller} />
              <OutputSection soundCheck={controller} />
            </section>
          </>
        )}
        {controller.isSupported ? (
          <SiteFooter
            soundCheck={controller}
            onRecheckPermission={controller.requestPermissionSync}
          />
        ) : (
          <SiteFooter soundCheck={controller} />
        )}
      </div>
    </main>
  );
}
