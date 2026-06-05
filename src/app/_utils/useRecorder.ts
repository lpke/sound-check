'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreferredMimeType } from './audio';
import type { RecordedClip } from './types';
import { toErrorMessage } from './utils';

export function useRecorder({
  ensureInputStream,
  setErrorMessage,
  setStatusMessage,
  onClipReady,
}: {
  ensureInputStream: () => Promise<MediaStream>;
  setErrorMessage: (message: string) => void;
  setStatusMessage: (message: string) => void;
  onClipReady: (clip: RecordedClip) => void;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const clipUrlRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage('');

    if (typeof MediaRecorder === 'undefined') {
      setErrorMessage('MediaRecorder is unavailable in this browser.');
      return;
    }

    try {
      const stream = await ensureInputStream();
      const mimeType = getPreferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopRecordingTimer();
        const chunks = recordingChunksRef.current;
        const durationSeconds = Math.max(
          0,
          (performance.now() - recordingStartedAtRef.current) / 1000,
        );

        if (chunks.length > 0) {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || 'audio/webm',
          });
          const url = URL.createObjectURL(blob);

          if (clipUrlRef.current) {
            URL.revokeObjectURL(clipUrlRef.current);
          }

          clipUrlRef.current = url;
          const clip: RecordedClip = {
            blob,
            durationSeconds,
            mimeType: blob.type || recorder.mimeType || 'audio/webm',
            url,
          };

          setRecordedClip({
            ...clip,
          });
          onClipReady(clip);
          setStatusMessage('Recording ready for playback.');
        }

        setIsRecording(false);
        mediaRecorderRef.current = null;
      };

      recorder.onerror = () => {
        setErrorMessage('Recording failed.');
        setIsRecording(false);
        stopRecordingTimer();
      };

      recorder.start(250);
      recordingStartedAtRef.current = performance.now();
      setRecordedClip((currentClip) => {
        if (currentClip) {
          URL.revokeObjectURL(currentClip.url);
          clipUrlRef.current = null;
        }
        return null;
      });
      setRecordingSeconds(0);
      setIsRecording(true);
      setStatusMessage('Recording microphone input.');

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(
          (performance.now() - recordingStartedAtRef.current) / 1000,
        );
      }, 100);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setIsRecording(false);
      stopRecordingTimer();
    }
  }, [
    ensureInputStream,
    onClipReady,
    setErrorMessage,
    setStatusMessage,
    stopRecordingTimer,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setStatusMessage('Finalizing recording.');
    }
  }, [setStatusMessage]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();

      if (clipUrlRef.current) {
        URL.revokeObjectURL(clipUrlRef.current);
      }
    };
  }, [stopRecordingTimer]);

  return {
    isRecording,
    recordingSeconds,
    recordedClip,
    startRecording,
    stopRecording,
  };
}
