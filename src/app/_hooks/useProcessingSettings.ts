import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';
import { defaultProcessingSettings } from '@/utils/soundCheckState';
import type { ProcessingSettingKey, ProcessingSettings } from '@/utils/types';

type UseProcessingSettingControlsOptions = {
  monitorEnabled: boolean;
  setProcessingEnabled: Dispatch<SetStateAction<boolean>>;
  setProcessingSettings: Dispatch<SetStateAction<ProcessingSettings>>;
  setStatusMessage: (message: string) => void;
  stopMonitorOutputGraph: () => void;
};

export function useProcessingSettings() {
  const [processingEnabled, setProcessingEnabled] = useState(true);
  const [processingSettings, setProcessingSettings] = useState(
    defaultProcessingSettings,
  );

  return {
    processingEnabled,
    processingSettings,
    setProcessingEnabled,
    setProcessingSettings,
  };
}

export function useProcessingSettingControls({
  monitorEnabled,
  setProcessingEnabled,
  setProcessingSettings,
  setStatusMessage,
  stopMonitorOutputGraph,
}: UseProcessingSettingControlsOptions) {
  const handleProcessingEnabledChange = useCallback(
    (enabled: boolean) => {
      if (monitorEnabled) {
        stopMonitorOutputGraph();
        setStatusMessage('Monitor stopped after processing change.');
      }

      setProcessingEnabled(enabled);
    },
    [
      monitorEnabled,
      setProcessingEnabled,
      setStatusMessage,
      stopMonitorOutputGraph,
    ],
  );

  const handleProcessingSettingChange = useCallback(
    (setting: ProcessingSettingKey, enabled: boolean) => {
      if (monitorEnabled) {
        stopMonitorOutputGraph();
        setStatusMessage('Monitor stopped after processing change.');
      }

      setProcessingSettings((currentSettings) => ({
        ...currentSettings,
        [setting]: enabled,
      }));
    },
    [
      monitorEnabled,
      setProcessingSettings,
      setStatusMessage,
      stopMonitorOutputGraph,
    ],
  );

  return {
    handleProcessingEnabledChange,
    handleProcessingSettingChange,
  };
}
