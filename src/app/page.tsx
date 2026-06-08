'use client';

import { InputSection } from '@/components/InputSection';
import { HelpModeProvider } from '@/components/HelpMode';
import { OutputSection } from '@/components/OutputSection';
import { SiteActions } from '@/components/SiteActions';
import { SiteFooter } from '@/components/SiteFooter';
import { UnsupportedPanel } from '@/components/UnsupportedPanel';
import { useSiteActionShadow } from '@/hooks/useSiteActionShadow';
import { useSoundCheck } from '@/hooks/useSoundCheck';

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
  const shouldShowShadow = useSiteActionShadow();

  return (
    <main className="bg-background text-foreground min-h-[100svh]">
      <audio ref={audioRef} className="hidden" playsInline />
      <audio ref={recordedPlaybackAudioRef} className="hidden" playsInline />
      <audio ref={monitorAudioRef} className="hidden" playsInline />

      <div className="mx-auto flex w-full max-w-6xl flex-col px-0 pb-5 sm:gap-6 sm:px-6 sm:pt-8 lg:px-8">
        <SiteActions
          shouldShowShadow={shouldShowShadow}
          soundCheck={controller}
        />
        <div className="grid gap-4 sm:contents">
          {!controller.isSupported ? (
            <div className="px-4 sm:px-0">
              <UnsupportedPanel />
            </div>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              <InputSection soundCheck={controller} />
              <OutputSection soundCheck={controller} />
            </section>
          )}
          {controller.isSupported ? (
            <SiteFooter
              shouldShowShadow={shouldShowShadow}
              soundCheck={controller}
              onRecheckPermission={controller.requestPermissionSync}
            />
          ) : (
            <SiteFooter
              shouldShowShadow={shouldShowShadow}
              soundCheck={controller}
            />
          )}
        </div>
      </div>
    </main>
  );
}
