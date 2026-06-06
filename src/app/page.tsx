'use client';

import { InputSection } from '@/components/InputSection';
import { HelpModeProvider, useHelpMode } from '@/components/HelpMode';
import { OutputSection } from '@/components/OutputSection';
import { SiteActions } from '@/components/SiteActions';
import { SiteFooter } from '@/components/SiteFooter';
import { UnsupportedPanel } from '@/components/UnsupportedPanel';
import { useSoundCheck } from '@/utils/useSoundCheck';
import { joinClasses } from '@/utils/utils';

export default function HomePage() {
  return (
    <HelpModeProvider>
      <HomePageContent />
    </HelpModeProvider>
  );
}

function HomePageContent() {
  const { audioRef, monitorAudioRef, recordedPlaybackAudioRef, controller } =
    useSoundCheck();
  const { isHelpModeActive } = useHelpMode();

  return (
    <main className="bg-background text-foreground min-h-[100svh]">
      <audio ref={audioRef} className="hidden" playsInline />
      <audio ref={recordedPlaybackAudioRef} className="hidden" playsInline />
      <audio ref={monitorAudioRef} className="hidden" playsInline />

      <div
        className={joinClasses(
          'mx-auto flex w-full max-w-6xl flex-col px-0 pb-5 transition-[gap,padding-top] duration-200 ease-out sm:gap-6 sm:px-6 sm:pt-8 lg:px-8',
          isHelpModeActive ? 'gap-0 pt-0 sm:gap-6' : 'gap-4 pt-4',
        )}
      >
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
  );
}
