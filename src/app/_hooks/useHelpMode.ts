import { useContext } from 'react';
import { HelpModeContext } from '@/utils/helpModeContext';

export function useHelpMode() {
  return (
    useContext(HelpModeContext) ?? {
      closeHelpMode: () => undefined,
      isHelpModeActive: false,
      isHelpModeExiting: false,
      toggleHelpMode: () => undefined,
    }
  );
}
