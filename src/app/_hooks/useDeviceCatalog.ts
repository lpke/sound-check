import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fallbackOutputDevice,
  getDeviceLabel,
  keepOrPickDevice,
  keepOrPickOutput,
  normalizeOutputs,
  toAudioDevice,
} from '@/utils/devices';
import {
  DEFAULT_OUTPUT_ID,
  type AudioDevice,
  type MediaDevicesWithOutputPicker,
} from '@/utils/types';
import { toErrorMessage } from '@/utils/utils';

type UseDeviceCatalogOptions = {
  setErrorMessage: (message: string) => void;
  setStatusMessage: (message: string) => void;
};

export function useDeviceCatalog({
  setErrorMessage,
  setStatusMessage,
}: UseDeviceCatalogOptions) {
  const [isSupported, setIsSupported] = useState(true);
  const [canRouteOutput, setCanRouteOutput] = useState(true);
  const [canRequestOutput, setCanRequestOutput] = useState(false);
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([
    fallbackOutputDevice,
  ]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState(DEFAULT_OUTPUT_ID);

  const selectedInputName = useMemo(
    () =>
      getDeviceLabel(
        inputDevices.find((device) => device.deviceId === selectedInputId),
        inputDevices,
        'audioinput',
      ),
    [inputDevices, selectedInputId],
  );

  const selectedOutputName = useMemo(
    () =>
      getDeviceLabel(
        outputDevices.find((device) => device.deviceId === selectedOutputId),
        outputDevices,
        'audiooutput',
      ),
    [outputDevices, selectedOutputId],
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setIsSupported(false);
      setStatusMessage('Media device APIs are unavailable in this browser.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextInputs = devices
        .filter((device) => device.kind === 'audioinput')
        .map(toAudioDevice);
      const nextOutputs = normalizeOutputs(
        devices
          .filter((device) => device.kind === 'audiooutput')
          .map(toAudioDevice),
      );

      setInputDevices(nextInputs);
      setOutputDevices(nextOutputs);
      setSelectedInputId((currentDeviceId) =>
        keepOrPickDevice(currentDeviceId, nextInputs),
      );
      setSelectedOutputId((currentDeviceId) =>
        keepOrPickOutput(currentDeviceId, nextOutputs),
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }, [setErrorMessage, setStatusMessage]);

  const requestOutputAccess = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputPicker;

    if (!mediaDevices.selectAudioOutput) {
      setStatusMessage('Output picker is unavailable in this browser.');
      return;
    }

    setErrorMessage('');

    try {
      const device = await mediaDevices.selectAudioOutput();
      await refreshDevices();
      setSelectedOutputId(device.deviceId || DEFAULT_OUTPUT_ID);
      setStatusMessage('Output access updated.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }, [refreshDevices, setErrorMessage, setStatusMessage]);

  const handleOutputChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedOutputId(event.target.value);
    },
    [],
  );

  useEffect(() => {
    window.queueMicrotask(() => {
      setCanRouteOutput(
        typeof HTMLMediaElement !== 'undefined' &&
          'setSinkId' in HTMLMediaElement.prototype,
      );
      setCanRequestOutput(
        Boolean(
          navigator.mediaDevices &&
          'selectAudioOutput' in navigator.mediaDevices,
        ),
      );
      void refreshDevices();
    });

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);

      return () => {
        navigator.mediaDevices.removeEventListener(
          'devicechange',
          refreshDevices,
        );
      };
    }

    return undefined;
  }, [refreshDevices]);

  return {
    canRequestOutput,
    canRouteOutput,
    handleOutputChange,
    inputDevices,
    isSupported,
    outputDevices,
    refreshDevices,
    requestOutputAccess,
    selectedInputId,
    selectedInputName,
    selectedOutputId,
    selectedOutputName,
    setSelectedInputId,
    setSelectedOutputId,
  };
}
