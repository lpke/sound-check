'use client';

import { InputSection } from '@/components/InputSection';
import { HelpModeProvider } from '@/components/HelpMode';
import { OutputSection } from '@/components/OutputSection';
import { SiteActions } from '@/components/SiteActions';
import { SiteFooter } from '@/components/SiteFooter';
import { UnsupportedPanel } from '@/components/UnsupportedPanel';
import { useSoundCheck } from '@/utils/useSoundCheck';

export default function HomePage() {
  const { audioRef, monitorAudioRef, recordedPlaybackAudioRef, controller } =
    useSoundCheck();

  return (
    <HelpModeProvider>
      <main className="bg-background text-foreground min-h-screen">
        <audio ref={audioRef} className="hidden" playsInline />
        <audio ref={recordedPlaybackAudioRef} className="hidden" playsInline />
        <audio ref={monitorAudioRef} className="hidden" playsInline />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-0 pt-4 pb-5 sm:gap-6 sm:px-6 sm:pt-8 lg:px-8">
          <SiteActions soundCheck={controller} />
          {!controller.isSupported ? (
            <div className="px-4 sm:px-0">
              <UnsupportedPanel />
            </div>
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
    </HelpModeProvider>
  );
}
