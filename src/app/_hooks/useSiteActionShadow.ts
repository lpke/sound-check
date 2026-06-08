'use client';

import { useEffect, useState } from 'react';

const DESKTOP_MEDIA_QUERY = '(min-width: 640px)';
const SITE_ACTION_ANCHOR_SELECTOR = '[data-site-action-anchor]';
const IO_SECTION_SELECTOR = '[data-io-section]';

function hasArea(rect: DOMRect) {
  return rect.width > 0 && rect.height > 0;
}

function rectanglesOverlap(firstRect: DOMRect, secondRect: DOMRect) {
  const width =
    Math.min(firstRect.right, secondRect.right) -
    Math.max(firstRect.left, secondRect.left);
  const height =
    Math.min(firstRect.bottom, secondRect.bottom) -
    Math.max(firstRect.top, secondRect.top);

  return width > 0 && height > 0;
}

function actionAnchorsOverlapIoSections() {
  const actionAnchors = Array.from(
    document.querySelectorAll<HTMLElement>(SITE_ACTION_ANCHOR_SELECTOR),
  );
  const ioSections = Array.from(
    document.querySelectorAll<HTMLElement>(IO_SECTION_SELECTOR),
  );

  return actionAnchors.some((actionAnchor) => {
    const actionRect = actionAnchor.getBoundingClientRect();

    if (!hasArea(actionRect)) {
      return false;
    }

    return ioSections.some((ioSection) => {
      const ioSectionRect = ioSection.getBoundingClientRect();

      return (
        hasArea(ioSectionRect) && rectanglesOverlap(actionRect, ioSectionRect)
      );
    });
  });
}

export function useSiteActionShadow() {
  const [shouldShowShadow, setShouldShowShadow] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    let animationFrameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    function measureOverlap() {
      animationFrameId = null;

      if (!mediaQuery.matches) {
        setShouldShowShadow(false);
        return;
      }

      setShouldShowShadow(actionAnchorsOverlapIoSections());
    }

    function scheduleMeasure() {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(measureOverlap);
    }

    function handleMediaQueryChange() {
      scheduleMeasure();
    }

    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    mediaQuery.addEventListener('change', handleMediaQueryChange);

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => scheduleMeasure());

      if (document.body) {
        resizeObserver.observe(document.body);
      }

      resizeObserver.observe(document.documentElement);

      const appContainer = document.querySelector('main');

      if (appContainer) {
        resizeObserver.observe(appContainer);
      }
    }

    scheduleMeasure();

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
      resizeObserver?.disconnect();
    };
  }, []);

  return shouldShowShadow;
}
