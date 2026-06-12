import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { clamp, joinClasses } from '@/utils/utils';
import type { SectionAccent } from './componentTypes';
import { numberInputClassName } from './controlStyles';
import { HelpLabel, HelpTarget } from './HelpMode';

const LOG_SCALE_POWER = 1.2;
const TOUCH_DRAG_LOCK_THRESHOLD_PX = 8;

type RangeDragState =
  | {
      pointerId: number;
      startX: number;
      startY: number;
      mode: 'pending' | 'horizontal';
    }
  | {
      pointerId: number;
      mode: 'vertical';
    };

function rangeBarClassName() {
  return joinClasses(
    'relative z-10 block h-3 w-full cursor-ew-resize rounded-b-none rounded-t-none border-0 bg-transparent outline-none appearance-none',
    'pointer-events-none',
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:m-0 [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent',
    '[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:m-0 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent',
    '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-none [&::-webkit-slider-runnable-track]:bg-transparent',
    '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-none [&::-moz-range-track]:bg-transparent',
  );
}

function logScaleValue(
  value: number,
  min: number,
  max: number,
  scaleMin: number,
  scaleMax: number,
) {
  if (value <= min) {
    return scaleMin;
  }

  if (value >= max) {
    return scaleMax;
  }

  const clamped = clamp(value, min, max);
  const ratio =
    (Math.log10(clamped) - Math.log10(min)) /
    (Math.log10(max) - Math.log10(min));

  return scaleMin + Math.pow(ratio, LOG_SCALE_POWER) * (scaleMax - scaleMin);
}

function antiLogScaleValue(
  value: number,
  min: number,
  max: number,
  scaleMin: number,
  scaleMax: number,
  step: number,
) {
  const clamped = clamp(value, scaleMin, scaleMax);
  const ratio = (clamped - scaleMin) / (scaleMax - scaleMin);
  const adjustedRatio = Math.pow(ratio, 1 / LOG_SCALE_POWER);
  const raw = min * Math.pow(max / min, adjustedRatio);
  const quantized = Math.round(raw / step) * step;

  return clamp(quantized, min, max);
}

function getDecimalPlaces(value: number) {
  const textValue = value.toString();

  if (textValue.includes('e-')) {
    return Number(textValue.split('e-')[1] ?? 0);
  }

  return textValue.split('.')[1]?.length ?? 0;
}

function snapValueToStep(
  value: number,
  min: number,
  max: number,
  step: number,
) {
  if (step <= 0) {
    return clamp(value, min, max);
  }

  const snappedValue = min + Math.round((value - min) / step) * step;
  const decimalPlaces = Math.max(getDecimalPlaces(min), getDecimalPlaces(step));

  return clamp(Number(snappedValue.toFixed(decimalPlaces)), min, max);
}

function formatNumberInputValue(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

export function RangeWithUnit({
  accent,
  ariaLabel,
  disabled = false,
  focusOnMount = false,
  idBase,
  label,
  max,
  min,
  commitOnRangeChange = true,
  step,
  showHelpLabel = true,
  showLabel = true,
  scaleMode = 'linear',
  showValueInLabel = true,
  unit,
  value,
  onChange,
  onCommit,
}: {
  accent: SectionAccent;
  ariaLabel: string;
  disabled?: boolean;
  focusOnMount?: boolean;
  idBase: string;
  label: string;
  max: number;
  min: number;
  commitOnRangeChange?: boolean;
  step: number;
  showHelpLabel?: boolean;
  showLabel?: boolean;
  scaleMode?: 'linear' | 'log';
  showValueInLabel?: boolean;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  const scaleMin = 0;
  const scaleMax = 1000;
  const isLogScale = scaleMode === 'log';
  const sliderMin = isLogScale ? scaleMin : min;
  const sliderMax = isLogScale ? scaleMax : max;
  const sliderStep = isLogScale ? 1 : step;
  const sliderValue = isLogScale
    ? logScaleValue(value, min, max, scaleMin, scaleMax)
    : value;
  const fillPercent = isLogScale
    ? clamp(((sliderValue - scaleMin) / (scaleMax - scaleMin)) * 100, 0, 100)
    : max === min
      ? 0
      : clamp(((value - min) / (max - min)) * 100, 0, 100);
  const fillColor = accent === 'input' ? '#2f8f4e' : '#2f70d0';
  const numberInputPaddingClassName = unit.length > 3 ? 'pr-14' : 'pr-10';
  const [isNumberEditing, setIsNumberEditing] = useState(false);
  const [numberInputValue, setNumberInputValue] = useState(() =>
    formatNumberInputValue(value),
  );
  const rangeDragStateRef = useRef<RangeDragState | null>(null);
  const rangeInputRef = useRef<HTMLInputElement | null>(null);
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const latestCommittedValueRef = useRef(value);
  const shouldRestoreNumberFocusRef = useRef(false);
  const previousDocumentCursorRef = useRef<string | null>(null);

  function commitSliderValue(rawValue: number) {
    const nextValue = isLogScale
      ? antiLogScaleValue(rawValue, min, max, scaleMin, scaleMax, step)
      : rawValue;

    if (isNumberEditing) {
      setNumberInputValue(formatNumberInputValue(nextValue));
    }

    onChange(nextValue);
    latestCommittedValueRef.current = nextValue;
  }

  function getCommittedNumberInputValue(rawValue: string) {
    if (rawValue.trim() === '') {
      return value;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
      return value;
    }

    return snapValueToStep(parsedValue, min, max, step);
  }

  function commitNumberInputValue(rawValue: string) {
    const nextValue = getCommittedNumberInputValue(rawValue);

    setNumberInputValue(formatNumberInputValue(nextValue));
    onChange(nextValue);
    latestCommittedValueRef.current = nextValue;
    onCommit?.(nextValue);
    setIsNumberEditing(false);
  }

  function handleNumberInputChange(nextValue: string) {
    setNumberInputValue(nextValue);

    if (nextValue.trim() === '') {
      return;
    }

    const parsedValue = Number(nextValue);

    if (
      !Number.isFinite(parsedValue) ||
      parsedValue < min ||
      parsedValue > max
    ) {
      return;
    }

    onChange(snapValueToStep(parsedValue, min, max, step));
    latestCommittedValueRef.current = snapValueToStep(
      parsedValue,
      min,
      max,
      step,
    );
  }

  function handleNumberInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setNumberInputValue(formatNumberInputValue(value));
      event.currentTarget.blur();
    }
  }

  function updateRangeFromPointer(event: PointerEvent<HTMLDivElement>) {
    const input = rangeInputRef.current;

    if (!input) {
      return;
    }

    const bounds = input.getBoundingClientRect();
    const ratio =
      bounds.width === 0
        ? 0
        : clamp((event.clientX - bounds.left) / bounds.width, 0, 1);

    const nextValue = sliderMin + ratio * (sliderMax - sliderMin);

    commitSliderValue(
      isLogScale ? nextValue : snapValueToStep(nextValue, min, max, step),
    );
  }

  function restoreNumberFocus() {
    if (!shouldRestoreNumberFocusRef.current) {
      return;
    }

    window.setTimeout(() => {
      numberInputRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function startDocumentResizeCursor() {
    if (previousDocumentCursorRef.current !== null) {
      return;
    }

    previousDocumentCursorRef.current = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'ew-resize';
  }

  function stopDocumentResizeCursor() {
    if (previousDocumentCursorRef.current === null) {
      return;
    }

    document.documentElement.style.cursor = previousDocumentCursorRef.current;
    previousDocumentCursorRef.current = null;
  }

  useEffect(() => {
    if (!focusOnMount || disabled) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      numberInputRef.current?.focus({ preventScroll: true });
      numberInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [disabled, focusOnMount]);

  useEffect(() => {
    latestCommittedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      stopDocumentResizeCursor();
    };
  }, []);

  function handleRangePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    shouldRestoreNumberFocusRef.current =
      document.activeElement === numberInputRef.current;

    if (event.pointerType !== 'touch') {
      rangeDragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        mode: 'horizontal',
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      startDocumentResizeCursor();
      updateRangeFromPointer(event);
      event.preventDefault();

      return;
    }

    rangeDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: 'pending',
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleRangePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    const dragState = rangeDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.mode === 'pending') {
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (
        absDeltaX < TOUCH_DRAG_LOCK_THRESHOLD_PX &&
        absDeltaY < TOUCH_DRAG_LOCK_THRESHOLD_PX
      ) {
        return;
      }

      if (absDeltaY > absDeltaX) {
        rangeDragStateRef.current = {
          pointerId: event.pointerId,
          mode: 'vertical',
        };

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        return;
      }

      rangeDragStateRef.current = {
        ...dragState,
        mode: 'horizontal',
      };
    } else if (dragState.mode === 'vertical') {
      return;
    }

    updateRangeFromPointer(event);
    event.preventDefault();
  }

  function handleRangePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    const dragState = rangeDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.mode === 'pending') {
      updateRangeFromPointer(event);
      event.preventDefault();
    } else if (dragState.mode === 'horizontal') {
      event.preventDefault();
    }

    rangeDragStateRef.current = null;
    stopDocumentResizeCursor();
    restoreNumberFocus();

    if (commitOnRangeChange) {
      onCommit?.(latestCommittedValueRef.current);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleRangePointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    const dragState = rangeDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    rangeDragStateRef.current = null;
    stopDocumentResizeCursor();
    restoreNumberFocus();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleRangeClick(event: MouseEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    event.preventDefault();
    restoreNumberFocus();
  }

  const rangeField = (
    <HelpTarget className="block rounded-lg">
      <div
        className={joinClasses(
          'relative grid w-full rounded-lg border transition-colors',
          isNumberEditing
            ? accent === 'input'
              ? 'border-input'
              : 'border-output'
            : 'border-line',
        )}
        style={{
          backgroundColor: 'var(--color-panel)',
        }}
      >
        <div className="relative">
          <input
            ref={numberInputRef}
            id={`${idBase}-number`}
            name={`${idBase}-number`}
            aria-label={ariaLabel}
            type="number"
            min={min}
            max={max}
            step={step}
            value={isNumberEditing ? numberInputValue : value}
            disabled={disabled}
            onChange={(event) => handleNumberInputChange(event.target.value)}
            onFocus={() => {
              setNumberInputValue(formatNumberInputValue(value));
              setIsNumberEditing(true);
            }}
            onBlur={(event) => commitNumberInputValue(event.target.value)}
            onKeyDown={handleNumberInputKeyDown}
            className={joinClasses(
              numberInputClassName(accent),
              numberInputPaddingClassName,
              disabled && 'disabled:opacity-100',
            )}
          />
          <span className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
            {unit}
          </span>
        </div>
        <div
          className="relative touch-pan-y select-none"
          onPointerCancel={handleRangePointerCancel}
          onPointerDownCapture={handleRangePointerDown}
          onPointerMove={handleRangePointerMove}
          onPointerUp={handleRangePointerEnd}
          onClickCapture={handleRangeClick}
        >
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-0 left-0 h-3 rounded-b-[calc(var(--radius-lg)-1px)]"
            style={{
              background: `linear-gradient(to right, ${fillColor} ${fillPercent}%, var(--color-line) ${fillPercent}%)`,
            }}
          />
          <input
            ref={rangeInputRef}
            id={idBase}
            name={idBase}
            aria-label={ariaLabel}
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={sliderValue}
            disabled={disabled}
            onChange={(event) => {
              commitSliderValue(Number(event.target.value));
            }}
            className={rangeBarClassName()}
          />
          <div
            aria-hidden="true"
            className={joinClasses(
              'absolute inset-x-0 -top-2 -bottom-2 z-20 select-none',
              disabled ? 'cursor-not-allowed' : 'cursor-ew-resize',
            )}
          />
        </div>
      </div>
    </HelpTarget>
  );
  const rangeLabel = (
    <HelpLabel
      align="center"
      arrowAlign="center"
      className="justify-self-center [--help-tip-gap:0.375rem]"
      label="Click or drag to adjust"
      layout="flow"
      placement="bottom"
    />
  );

  return (
    <div className="grid gap-1">
      {showLabel ? (
        <div className="block">
          <span className="text-foreground mb-2 block text-sm font-semibold">
            {showValueInLabel ? `${label}: ${value} ${unit}` : label}
          </span>
          {rangeField}
        </div>
      ) : (
        rangeField
      )}
      {showHelpLabel ? rangeLabel : null}
    </div>
  );
}
