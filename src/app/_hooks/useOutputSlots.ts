import { type SetStateAction, useCallback, useRef, useState } from 'react';
import { updateFrequencyPeaks, type OutputSlot } from '@/utils/soundCheckState';
import type { FrequencyLevels } from '@/utils/types';

export function useOutputSlots() {
  const outputSlotLevelsRef = useRef<Record<OutputSlot, number>>({
    monitor: 0,
    music: 0,
    recording: 0,
  });
  const outputSlotSpectraRef = useRef<Record<OutputSlot, FrequencyLevels>>({
    monitor: [],
    music: [],
    recording: [],
  });
  const [outputLevel, setOutputLevel] = useState(0);
  const [outputSpectrum, setOutputSpectrum] = useState<FrequencyLevels>([]);
  const [outputSpectrumPeaks, setOutputSpectrumPeaks] =
    useState<FrequencyLevels>([]);

  const setOutputSlotLevel = useCallback(
    (slot: OutputSlot, nextLevel: SetStateAction<number>) => {
      const computedNextLevel =
        typeof nextLevel === 'function'
          ? nextLevel(outputSlotLevelsRef.current[slot])
          : nextLevel;

      outputSlotLevelsRef.current[slot] = computedNextLevel;
      setOutputLevel(
        Math.max(
          outputSlotLevelsRef.current.monitor,
          outputSlotLevelsRef.current.music,
          outputSlotLevelsRef.current.recording,
        ),
      );
    },
    [],
  );

  const clearOutputSlotLevel = useCallback(
    (slot: OutputSlot) => {
      setOutputSlotLevel(slot, 0);
    },
    [setOutputSlotLevel],
  );

  const setOutputSlotSpectrum = useCallback(
    (slot: OutputSlot, nextSpectrum: FrequencyLevels) => {
      outputSlotSpectraRef.current[slot] = nextSpectrum;

      const spectra = Object.values(outputSlotSpectraRef.current);
      const mergedLength = Math.max(
        0,
        ...spectra.map((spectrum) => spectrum.length),
      );

      if (mergedLength === 0) {
        setOutputSpectrum([]);
        setOutputSpectrumPeaks([]);
        return;
      }

      const mergedSpectrum = Array.from({ length: mergedLength }, (_, index) =>
        Math.max(
          outputSlotSpectraRef.current.monitor[index] ?? 0,
          outputSlotSpectraRef.current.music[index] ?? 0,
          outputSlotSpectraRef.current.recording[index] ?? 0,
        ),
      );

      setOutputSpectrum(mergedSpectrum);
      setOutputSpectrumPeaks((currentPeaks) =>
        updateFrequencyPeaks(currentPeaks, mergedSpectrum),
      );
    },
    [],
  );

  const clearOutputSlotSpectrum = useCallback(
    (slot: OutputSlot) => {
      setOutputSlotSpectrum(slot, []);
    },
    [setOutputSlotSpectrum],
  );

  return {
    clearOutputSlotLevel,
    clearOutputSlotSpectrum,
    outputLevel,
    outputSpectrum,
    outputSpectrumPeaks,
    setOutputSlotLevel,
    setOutputSlotSpectrum,
  };
}
