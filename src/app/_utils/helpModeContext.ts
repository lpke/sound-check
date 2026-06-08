import { createContext } from 'react';

export type HelpModeContextValue = {
  closeHelpMode: () => void;
  isHelpModeActive: boolean;
  isHelpModeExiting: boolean;
  toggleHelpMode: () => void;
};

export const HelpModeContext = createContext<HelpModeContextValue | null>(null);
