'use client';

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useAppAudioControls,
  useAppAudioState,
} from '@/hooks/useAppAudioControls';
import { useDeviceCatalog } from '@/hooks/useDeviceCatalog';
import { useInputStream } from '@/hooks/useInputStream';
import { useMonitorOutput } from '@/hooks/useMonitorOutput';
import { useOutputRouting } from '@/hooks/useOutputRouting';
import { useOutputSlots } from '@/hooks/useOutputSlots';
import {
  useProcessingSettingControls,
  useProcessingSettings,
} from '@/hooks/useProcessingSettings';
import { useRecordedClipActions } from '@/hooks/useRecordedClipActions';
import { useRecordedClipStorageSync } from '@/hooks/useRecordedClipStorageSync';
import { useRecordedPlayback } from '@/hooks/useRecordedPlayback';
import { useRecordingCapture } from '@/hooks/useRecordingCapture';
import { useSoundCheckStatus } from '@/hooks/useSoundCheckStatus';
import { useSpeakerTestPlayback } from '@/hooks/useSpeakerTestPlayback';
import { hasDeviceQualityWarning } from '@/utils/deviceWarnings';
import type { NamedRecordedClip } from '@/utils/types';

type PendingOutputRestart =
  | { mode: 'clip'; clipId: string }
  | { mode: 'monitor' }
  | { mode: 'speakerTest' }
  | null;

export function useSoundCheck() {
  const [statusMessage, setStatusMessage] = useState(
    'Starting microphone when access is available.',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const audioState = useAppAudioState();
  const { appPaused, inputMuted, outputMuted } = audioState;
  const processing = useProcessingSettings();
  const devices = useDeviceCatalog({
    setErrorMessage,
    setStatusMessage,
  });
  const {
    requestOutputAccess: requestDeviceOutputAccess,
    setSelectedInputId,
    setSelectedOutputId,
  } = devices;
  const input = useInputStream({
    appPaused,
    inputMuted,
    processingEnabled: processing.processingEnabled,
    processingSettings: processing.processingSettings,
    refreshDevices: devices.refreshDevices,
    selectedInputId: devices.selectedInputId,
    setErrorMessage,
    setStatusMessage,
  });
  const outputSlots = useOutputSlots();
  const outputRouting = useOutputRouting({
    appPaused,
    outputMuted,
    selectedOutputId: devices.selectedOutputId,
    setErrorMessage,
  });
  const speakerTest = useSpeakerTestPlayback({
    appPaused,
    clearOutputSlotLevel: outputSlots.clearOutputSlotLevel,
    clearOutputSlotSpectrum: outputSlots.clearOutputSlotSpectrum,
    outputMuted,
    resetPlaybackOutput: outputRouting.resetPlaybackOutput,
    routePlaybackStreamToOutput: outputRouting.routePlaybackStreamToOutput,
    selectedOutputName: devices.selectedOutputName,
    setErrorMessage,
    setOutputSlotLevel: outputSlots.setOutputSlotLevel,
    setOutputSlotSpectrum: outputSlots.setOutputSlotSpectrum,
    setStatusMessage,
  });
  const [recordedClips, setRecordedClips] = useState<NamedRecordedClip[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
    null,
  );
  const [pendingOutputRestart, setPendingOutputRestart] =
    useState<PendingOutputRestart>(null);
  const selectedRecordedClip = useMemo(() => {
    if (!selectedRecordingId) {
      return null;
    }

    return (
      recordedClips.find((clip) => clip.id === selectedRecordingId) ?? null
    );
  }, [recordedClips, selectedRecordingId]);
  const recordedPlayback = useRecordedPlayback({
    appPaused,
    clearOutputSlotLevel: outputSlots.clearOutputSlotLevel,
    clearOutputSlotSpectrum: outputSlots.clearOutputSlotSpectrum,
    outputMuted,
    recordedClips,
    resetRecordedPlaybackOutput: outputRouting.resetRecordedPlaybackOutput,
    routeRecordedPlaybackStreamToOutput:
      outputRouting.routeRecordedPlaybackStreamToOutput,
    selectedOutputName: devices.selectedOutputName,
    selectedRecordedClip,
    setErrorMessage,
    setOutputSlotLevel: outputSlots.setOutputSlotLevel,
    setOutputSlotSpectrum: outputSlots.setOutputSlotSpectrum,
    setSelectedRecordingId,
    setStatusMessage,
  });
  const monitor = useMonitorOutput({
    appPaused,
    clearOutputSlotLevel: outputSlots.clearOutputSlotLevel,
    clearOutputSlotSpectrum: outputSlots.clearOutputSlotSpectrum,
    ensureInputStream: input.ensureInputStream,
    inputMuted,
    outputMuted,
    resetMonitorOutput: outputRouting.resetMonitorOutput,
    routeMonitorStreamToOutput: outputRouting.routeMonitorStreamToOutput,
    selectedOutputName: devices.selectedOutputName,
    setErrorMessage,
    setOutputSlotLevel: outputSlots.setOutputSlotLevel,
    setOutputSlotSpectrum: outputSlots.setOutputSlotSpectrum,
    setStatusMessage,
  });
  const recordingCapture = useRecordingCapture({
    appPaused,
    ensureInputStream: input.ensureInputStream,
    inputDevices: devices.inputDevices,
    inputMuted,
    selectedInputId: devices.selectedInputId,
    selectedInputName: devices.selectedInputName,
    setErrorMessage,
    setRecordedClips,
    setRecordedPlayback: recordedPlayback.setRecordedPlayback,
    setSelectedRecordingId,
    setStatusMessage,
  });

  useRecordedClipStorageSync({
    recordedClips,
    setErrorMessage,
    setRecordedClips,
    setRecordedPlayback: recordedPlayback.setRecordedPlayback,
    setSelectedRecordingId,
  });

  const recordedActions = useRecordedClipActions({
    cancelAllRecordingBitrateEncodes:
      recordingCapture.cancelAllRecordingBitrateEncodes,
    cancelRecordingBitrateEncode: recordingCapture.cancelRecordingBitrateEncode,
    recordedClips,
    recordedPlayback: recordedPlayback.recordedPlayback,
    setErrorMessage,
    setRecordedClips,
    setRecordedPlayback: recordedPlayback.setRecordedPlayback,
    setSelectedRecordingId,
    setStatusMessage,
    stopRecordedPlaybackOutputGraph:
      recordedPlayback.stopRecordedPlaybackOutputGraph,
  });
  const stopMusicOutputGraph = speakerTest.stopMusicOutputGraph;
  const stopMonitorOutputGraph = monitor.stopMonitorOutputGraph;
  const stopRecordedPlaybackOutputGraph =
    recordedPlayback.stopRecordedPlaybackOutputGraph;
  const stopInputStream = input.stopInputStream;
  const stopPlaybackOutputGraph = useCallback(
    ({
      preserveMusicPosition = false,
      resetRecordedPosition = false,
    }: {
      preserveMusicPosition?: boolean;
      resetRecordedPosition?: boolean;
    } = {}) => {
      stopMusicOutputGraph({ preservePosition: preserveMusicPosition });
      stopRecordedPlaybackOutputGraph({
        resetRecordedPosition,
      });
    },
    [stopMusicOutputGraph, stopRecordedPlaybackOutputGraph],
  );
  const stopOutputGraph = useCallback(
    ({
      preserveMusicPosition = false,
      resetRecordedPosition = false,
    }: {
      preserveMusicPosition?: boolean;
      resetRecordedPosition?: boolean;
    } = {}) => {
      stopPlaybackOutputGraph({ preserveMusicPosition, resetRecordedPosition });
      stopMonitorOutputGraph();
    },
    [stopMonitorOutputGraph, stopPlaybackOutputGraph],
  );
  const getShouldResetOutputForDeviceWarning = useCallback(
    ({
      selectedInputId = devices.selectedInputId,
      selectedOutputId = devices.selectedOutputId,
    }: {
      selectedInputId?: string;
      selectedOutputId?: string;
    } = {}) =>
      !appPaused &&
      !inputMuted &&
      !outputMuted &&
      hasDeviceQualityWarning({
        inputDevices: devices.inputDevices,
        outputDevices: devices.outputDevices,
        selectedInputId,
        selectedOutputId,
      }),
    [
      appPaused,
      devices.inputDevices,
      devices.outputDevices,
      devices.selectedInputId,
      devices.selectedOutputId,
      inputMuted,
      outputMuted,
    ],
  );
  const shouldResetOutputForDeviceWarning =
    getShouldResetOutputForDeviceWarning();
  const resetOutputForDeviceWarning = useCallback(
    ({ resumeMonitor = true }: { resumeMonitor?: boolean } = {}) => {
      const activeClipId = recordedPlayback.recordedPlayback.activeClipId;
      const isPausableSpeakerTest =
        speakerTest.speakerTestSettings.kind === 'music' ||
        speakerTest.speakerTestSettings.kind === 'dialUp';
      const shouldRestartSpeakerTest =
        speakerTest.isMusicOutputActive &&
        (!isPausableSpeakerTest || speakerTest.musicPlayback.isPlaying);
      const nextRestart: PendingOutputRestart = shouldRestartSpeakerTest
        ? { mode: 'speakerTest' }
        : recordedPlayback.isRecordingPlaybackActive &&
            recordedPlayback.recordedPlayback.isPlaying &&
            activeClipId
          ? { mode: 'clip', clipId: activeClipId }
          : monitor.monitorEnabled && resumeMonitor
            ? { mode: 'monitor' }
            : null;

      setPendingOutputRestart(nextRestart);
      stopOutputGraph({ preserveMusicPosition: true });
    },
    [
      monitor.monitorEnabled,
      recordedPlayback.isRecordingPlaybackActive,
      recordedPlayback.recordedPlayback.activeClipId,
      recordedPlayback.recordedPlayback.isPlaying,
      speakerTest.isMusicOutputActive,
      speakerTest.musicPlayback.isPlaying,
      speakerTest.speakerTestSettings.kind,
      stopOutputGraph,
    ],
  );
  const appControls = useAppAudioControls(audioState, {
    monitorEnabled: monitor.monitorEnabled,
    resetOutputForDeviceWarning,
    setStatusMessage,
    shouldResetOutputForDeviceWarning,
    stopInputStream,
    stopMonitorOutputGraph,
    stopOutputGraph,
    stopRecording: recordingCapture.stopRecording,
  });
  const processingControls = useProcessingSettingControls({
    monitorEnabled: monitor.monitorEnabled,
    setProcessingEnabled: processing.setProcessingEnabled,
    setProcessingSettings: processing.setProcessingSettings,
    setStatusMessage,
    stopMonitorOutputGraph,
  });
  const status = useSoundCheckStatus({
    appPaused,
    inputLevel: input.inputLevel,
    inputMuted,
    isMusicOutputActive: speakerTest.isMusicOutputActive,
    isRecordingPlaybackActive: recordedPlayback.isRecordingPlaybackActive,
    monitorEnabled: monitor.monitorEnabled,
    outputLevel: outputSlots.outputLevel,
    outputMuted,
    permissionState: input.permissionState,
  });

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSelectedInputId = event.target.value;

      if (
        getShouldResetOutputForDeviceWarning({
          selectedInputId: nextSelectedInputId,
        })
      ) {
        resetOutputForDeviceWarning();
      } else if (monitor.monitorEnabled) {
        stopMonitorOutputGraph();
        setStatusMessage('Monitor stopped after input change.');
      }

      setSelectedInputId(nextSelectedInputId);
    },
    [
      getShouldResetOutputForDeviceWarning,
      monitor.monitorEnabled,
      resetOutputForDeviceWarning,
      setSelectedInputId,
      setStatusMessage,
      stopMonitorOutputGraph,
    ],
  );
  const handleOutputChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSelectedOutputId = event.target.value;

      if (
        getShouldResetOutputForDeviceWarning({
          selectedOutputId: nextSelectedOutputId,
        })
      ) {
        resetOutputForDeviceWarning();
      }

      setSelectedOutputId(nextSelectedOutputId);
    },
    [
      getShouldResetOutputForDeviceWarning,
      resetOutputForDeviceWarning,
      setSelectedOutputId,
    ],
  );
  const requestOutputAccess = useCallback(async () => {
    const nextSelectedOutputId = await requestDeviceOutputAccess();

    if (
      nextSelectedOutputId &&
      getShouldResetOutputForDeviceWarning({
        selectedOutputId: nextSelectedOutputId,
      })
    ) {
      resetOutputForDeviceWarning();
    }
  }, [
    getShouldResetOutputForDeviceWarning,
    requestDeviceOutputAccess,
    resetOutputForDeviceWarning,
  ]);

  const startMonitor = monitor.startMonitor;
  const playRecordedClip = recordedPlayback.playRecordedClip;
  const startSpeakerTest = speakerTest.startSpeakerTest;

  useEffect(() => {
    if (!pendingOutputRestart || appPaused || outputMuted) {
      return undefined;
    }

    const restart = pendingOutputRestart;
    const restartTimer = window.setTimeout(() => {
      setPendingOutputRestart(null);

      if (restart.mode === 'speakerTest') {
        void startSpeakerTest();
        return;
      }

      if (restart.mode === 'clip') {
        void playRecordedClip(restart.clipId);
        return;
      }

      if (!inputMuted) {
        void startMonitor();
      }
    }, 0);

    return () => {
      window.clearTimeout(restartTimer);
    };
  }, [
    appPaused,
    inputMuted,
    outputMuted,
    pendingOutputRestart,
    playRecordedClip,
    startMonitor,
    startSpeakerTest,
  ]);

  useEffect(() => {
    return () => {
      stopOutputGraph();
      stopInputStream();
    };
  }, [stopInputStream, stopOutputGraph]);

  const controller = {
    isSupported: devices.isSupported,
    canRouteOutput: devices.canRouteOutput,
    canRequestOutput: devices.canRequestOutput,
    permissionState: input.permissionState,
    inputDevices: devices.inputDevices,
    outputDevices: devices.outputDevices,
    selectedInputId: devices.selectedInputId,
    selectedOutputId: devices.selectedOutputId,
    selectedInputName: devices.selectedInputName,
    selectedOutputName: devices.selectedOutputName,
    appPaused,
    allAudioStopped: appControls.allAudioStopped,
    inputMuted,
    inputSignalState: status.inputSignalState,
    outputMuted,
    outputSignalState: status.outputSignalState,
    processingEnabled: processing.processingEnabled,
    processingSettings: processing.processingSettings,
    speakerTestSettings: speakerTest.speakerTestSettings,
    musicPlayback: speakerTest.musicPlayback,
    monitorEnabled: monitor.monitorEnabled,
    monitorDelayMs: monitor.monitorDelayMs,
    routedMode: status.routedMode,
    inputLevel: input.inputLevel,
    outputLevel: outputSlots.outputLevel,
    inputSpectrum: input.inputSpectrum,
    outputSpectrum: outputSlots.outputSpectrum,
    inputSpectrumPeaks: input.inputSpectrumPeaks,
    outputSpectrumPeaks: outputSlots.outputSpectrumPeaks,
    inputStatus: status.inputStatus,
    outputStatus: status.outputStatus,
    isRecording: recordingCapture.isRecording,
    recordingSeconds: recordingCapture.recordingSeconds,
    recordingBitrateKbps: recordingCapture.recordingBitrateKbps,
    saveRecordingWithCustomBitrate:
      recordingCapture.saveRecordingWithCustomBitrate,
    encodingRecordedClipProgressById:
      recordingCapture.encodingRecordedClipProgressById,
    recordedClips,
    recordedClip: recordingCapture.recordedClip,
    recordedPlayback: recordedPlayback.recordedPlayback,
    statusMessage,
    errorMessage,
    pauseApp: appControls.pauseApp,
    resumeApp: appControls.resumeApp,
    toggleAllAudio: appControls.toggleAllAudio,
    toggleInputMute: appControls.toggleInputMute,
    toggleOutputMute: appControls.toggleOutputMute,
    refreshDevices: devices.refreshDevices,
    startSpeakerTest: speakerTest.startSpeakerTest,
    stopOutputGraph,
    pauseMusicPlayback: speakerTest.pauseMusicPlayback,
    resumeMusicPlayback: speakerTest.resumeMusicPlayback,
    toggleMusicPlayback: speakerTest.toggleMusicPlayback,
    handleMusicSeek: speakerTest.handleMusicSeek,
    markMusicPosition: speakerTest.markMusicPosition,
    playMusicFromMark: speakerTest.playMusicFromMark,
    deleteMusicMark: speakerTest.deleteMusicMark,
    startMonitor: monitor.startMonitor,
    stopMonitor: monitor.stopMonitor,
    handleRecordedClipSeek: recordedPlayback.handleRecordedClipSeek,
    renameRecordedClip: recordedActions.renameRecordedClip,
    deleteRecordedClip: recordedActions.deleteRecordedClip,
    deleteAllRecordedClips: recordedActions.deleteAllRecordedClips,
    duplicateRecordedClipWithBitrate:
      recordedActions.duplicateRecordedClipWithBitrate,
    selectRecordedClip: recordedActions.selectRecordedClip,
    startRecording: recordingCapture.startRecording,
    stopRecording: recordingCapture.stopRecording,
    playRecordedClip: recordedPlayback.playRecordedClip,
    toggleRecordedClipPlayback: recordedPlayback.toggleRecordedClipPlayback,
    requestMicrophoneAccess: input.requestMicrophoneAccess,
    requestPermissionSync: input.requestPermissionSync,
    requestOutputAccess,
    handleInputChange,
    handleOutputChange,
    stopPlaybackOutput: speakerTest.stopMusicOutputGraph,
    stopRecordedPlaybackOutput:
      recordedPlayback.stopRecordedPlaybackOutputGraph,
    handleSpeakerMusicFileChange: speakerTest.handleSpeakerMusicFileChange,
    handleSpeakerMusicQualityChange:
      speakerTest.handleSpeakerMusicQualityChange,
    handleSpeakerMusicSourceChange: speakerTest.handleSpeakerMusicSourceChange,
    handleSpeakerTestKindChange: speakerTest.handleSpeakerTestKindChange,
    handleSpeakerToneFrequencyChange:
      speakerTest.handleSpeakerToneFrequencyChange,
    handleProcessingEnabledChange:
      processingControls.handleProcessingEnabledChange,
    handleProcessingSettingChange:
      processingControls.handleProcessingSettingChange,
    handleDelayChange: monitor.handleDelayChange,
    handleRecordingBitrateChange: recordingCapture.handleRecordingBitrateChange,
    handleSaveRecordingWithCustomBitrateChange:
      recordingCapture.handleSaveRecordingWithCustomBitrateChange,
  };

  return {
    audioRef: outputRouting.musicPlaybackAudioRef,
    recordedPlaybackAudioRef: outputRouting.recordedPlaybackAudioRef,
    monitorAudioRef: outputRouting.monitorAudioRef,
    controller,
  };
}

export type SoundCheckController = ReturnType<
  typeof useSoundCheck
>['controller'];
