import { useRef, useState, type PointerEvent } from 'react';
import { clamp, joinClasses } from '@/utils/utils';
import type { SectionAccent } from './componentTypes';
import { numberInputClassName } from './controlStyles';
import { HelpLabel, HelpTarget } from './HelpMode';
import { Field } from './ui';

const LOG_SCALE_POWER = 1.2;

function rangeBarClassName() {
  return joinClasses(
    'relative z-10 block h-3 w-full cursor-ew-resize rounded-b-none rounded-t-none border-0 bg-transparent outline-none appearance-none',
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

export function RangeWithUnit({
  accent,
  ariaLabel,
  idBase,
  label,
  max,
  min,
  step,
  showLabel = true,
  scaleMode = 'linear',
  showValueInLabel = true,
  unit,
  value,
  onChange,
}: {
  accent: SectionAccent;
  ariaLabel: string;
  idBase: string;
  label: string;
  max: number;
  min: number;
  step: number;
  showLabel?: boolean;
  scaleMode?: 'linear' | 'log';
  showValueInLabel?: boolean;
  unit: string;
  value: number;
  onChange: (value: number) => void;
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
  const [isNumberEditing, setIsNumberEditing] = useState(false);
  const activeRangePointerIdRef = useRef<number | null>(null);
  const rangeInputRef = useRef<HTMLInputElement | null>(null);

  function commitSliderValue(rawValue: number) {
    onChange(
      isLogScale
        ? antiLogScaleValue(rawValue, min, max, scaleMin, scaleMax, step)
        : rawValue,
    );
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

  function handleRangePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') {
      return;
    }

    activeRangePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateRangeFromPointer(event);
    event.preventDefault();
  }

  function handleRangePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (activeRangePointerIdRef.current !== event.pointerId) {
      return;
    }

    updateRangeFromPointer(event);
    event.preventDefault();
  }

  function handleRangePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (activeRangePointerIdRef.current !== event.pointerId) {
      return;
    }

    activeRangePointerIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const rangeField = (
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
          id={`${idBase}-number`}
          name={`${idBase}-number`}
          aria-label={ariaLabel}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onFocus={() => setIsNumberEditing(true)}
          onBlur={() => setIsNumberEditing(false)}
          className={joinClasses(numberInputClassName(accent), 'pr-10')}
        />
        <span className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
          {unit}
        </span>
      </div>
      <HelpTarget
        className="block rounded-b-lg"
        highlightClassName="rounded-b-lg"
      >
        <div
          className="relative touch-none select-none"
          onPointerCancel={handleRangePointerEnd}
          onPointerDownCapture={handleRangePointerDown}
          onPointerMove={handleRangePointerMove}
          onPointerUp={handleRangePointerEnd}
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
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={sliderValue}
            onChange={(event) => {
              commitSliderValue(Number(event.target.value));
            }}
            className={rangeBarClassName()}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-2 -bottom-2 z-20 select-none [@media(pointer:coarse)]:pointer-events-auto"
          />
        </div>
      </HelpTarget>
    </div>
  );
  const rangeLabel = (
    <HelpLabel
      align="end"
      arrowAlign="end"
      className="justify-self-end [--help-tip-gap:0.375rem]"
      label="Click or drag to adjust"
      layout="flow"
      placement="bottom"
    />
  );

  return (
    <div className="grid gap-1">
      {showLabel ? (
        <Field label={showValueInLabel ? `${label}: ${value} ${unit}` : label}>
          {rangeField}
        </Field>
      ) : (
        rangeField
      )}
      {rangeLabel}
    </div>
  );
}
