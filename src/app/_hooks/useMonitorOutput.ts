import { useCallback, useRef, useState } from 'react';
import { createMonitorOutputGraph } from '@/utils/audio';
import type {
  ActiveOutputGraph,
  FrequencyLevels,
  LevelSetter,
} from '@/utils/types';
import { MAX_MONITOR_DELAY_MS } from '@/utils/types';
import { clamp, toErrorMessage } from '@/utils/utils';

type UseMonitorOutputOptions = {
  appPaused: boolean;
  clearOutputSlotLevel: (slot: 'monitor') => void;
  clearOutputSlotSpectrum: (slot: 'monitor') => void;
  ensureInputStream: () => Promise<MediaStream>;
  inputMuted: boolean;
  outputMuted: boolean;
  resetMonitorOutput: () => void;
  routeMonitorStreamToOutput: (stream: MediaStream) => Promise<void>;
  selectedOutputName: string;
  setErrorMessage: (message: string) => void;
  setOutputSlotLevel: (
    slot: 'monitor',
    nextLevel: Parameters<LevelSetter>[0],
  ) => void;
  setOutputSlotSpectrum: (
    slot: 'monitor',
    nextSpectrum: FrequencyLevels,
  ) => void;
  setStatusMessage: (message: string) => void;
};

export function useMonitorOutput({
  appPaused,
  clearOutputSlotLevel,
  clearOutputSlotSpectrum,
  ensureInputStream,
  inputMuted,
  outputMuted,
  resetMonitorOutput,
  routeMonitorStreamToOutput,
  selectedOutputName,
  setErrorMessage,
  setOutputSlotLevel,
  setOutputSlotSpectrum,
  setStatusMessage,
}: UseMonitorOutputOptions) {
  const monitorOutputGraphRef = useRef<ActiveOutputGraph | null>(null);
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorDelayMs, setMonitorDelayMs] = useState(0);

  const stopMonitorOutputGraph = useCallback(() => {
    const activeGraph = monitorOutputGraphRef.current;

    monitorOutputGraphRef.current = null;
    setMonitorEnabled(false);

    if (activeGraph) {
      activeGraph.cancel();
      activeGraph.context.close().catch(() => undefined);
    }

    resetMonitorOutput();
    clearOutputSlotLevel('monitor');
    clearOutputSlotSpectrum('monitor');
  }, [clearOutputSlotLevel, clearOutputSlotSpectrum, resetMonitorOutput]);

  const startMonitor = useCallback(async () => {
    if (appPaused || inputMuted || outputMuted) {
      setStatusMessage(
        inputMuted
          ? 'Unmute the microphone section before monitoring input.'
          : outputMuted
            ? 'Unmute the speaker section before monitoring input.'
            : 'Resume the app before monitoring input.',
      );
      return;
    }

    setErrorMessage('');
    stopMonitorOutputGraph();

    try {
      const stream = await ensureInputStream();
      monitorOutputGraphRef.current = await createMonitorOutputGraph({
        delayMs: monitorDelayMs,
        routeStreamToOutput: routeMonitorStreamToOutput,
        setOutputLevel: (nextLevel) => setOutputSlotLevel('monitor', nextLevel),
        setOutputSpectrum: (nextSpectrum) =>
          setOutputSlotSpectrum('monitor', nextSpectrum),
        stream,
      });

      setMonitorEnabled(true);
      setStatusMessage(
        monitorDelayMs === 0
          ? `Live monitor routed to ${selectedOutputName}.`
          : `Delayed monitor routed to ${selectedOutputName}.`,
      );
    } catch (error) {
      stopMonitorOutputGraph();
      setMonitorEnabled(false);
      setErrorMessage(toErrorMessage(error));
    }
  }, [
    appPaused,
    ensureInputStream,
    inputMuted,
    monitorDelayMs,
    outputMuted,
    routeMonitorStreamToOutput,
    selectedOutputName,
    setErrorMessage,
    setOutputSlotLevel,
    setOutputSlotSpectrum,
    setStatusMessage,
    stopMonitorOutputGraph,
  ]);

  const stopMonitor = useCallback(() => {
    stopMonitorOutputGraph();
    setStatusMessage('Monitor stopped.');
  }, [setStatusMessage, stopMonitorOutputGraph]);

  const handleDelayChange = useCallback((nextDelayMs: number) => {
    const boundedDelay = clamp(nextDelayMs, 0, MAX_MONITOR_DELAY_MS);

    setMonitorDelayMs(boundedDelay);
    monitorOutputGraphRef.current?.updateDelay?.(boundedDelay / 1000);
  }, []);

  return {
    handleDelayChange,
    monitorDelayMs,
    monitorEnabled,
    startMonitor,
    stopMonitor,
    stopMonitorOutputGraph,
  };
}
