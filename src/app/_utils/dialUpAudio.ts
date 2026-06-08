import { clamp } from './utils';

export const DIAL_UP_DURATION_SECONDS = 25.2;

const DIAL_UP_MAX_FREQUENCY_HZ = 3800;
const HANDSHAKE_STEP_SECONDS = 0.04;
const TWO_PI = Math.PI * 2;

type ToneOptions = {
  amplitudeModulationDepth?: number;
  amplitudeModulationHz?: number;
  frequencyDriftHz?: number;
  frequencyDriftRateHz?: number;
  phaseReverseSeconds?: number;
};

export function createDialUpAudioBuffer(context: AudioContext) {
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(
    1,
    Math.ceil(DIAL_UP_DURATION_SECONDS * sampleRate),
    sampleRate,
  );
  const data = buffer.getChannelData(0);

  renderLineNoise(data, sampleRate, 0, DIAL_UP_DURATION_SECONDS, 0.0016, 19);
  renderTone(data, sampleRate, 0, 1.16, [350, 440], 0.088, {
    frequencyDriftHz: 0.35,
    frequencyDriftRateHz: 1.1,
  });
  renderDtmfNumber(data, sampleRate, 1.27, '5550199');
  renderLineClick(data, sampleRate, 2.32, 0.055, 23);
  renderTone(data, sampleRate, 2.47, 1.95, [440, 480], 0.066, {
    frequencyDriftHz: 0.2,
    frequencyDriftRateHz: 0.8,
  });
  renderV25CallingTone(data, sampleRate, 2.74, 2);
  renderLineClick(data, sampleRate, 4.73, 0.07, 31);
  renderTone(data, sampleRate, 5.05, 2.86, 2100, 0.15, {
    amplitudeModulationDepth: 0.2,
    amplitudeModulationHz: 15,
    phaseReverseSeconds: 0.45,
  });
  renderAnswerToneBroadening(data, sampleRate, 6.52, 1.86);
  renderLineClick(data, sampleRate, 8.18, 0.022, 37);
  renderV8MenuExchange(data, sampleRate, 8.5, 1.02);
  renderV34InfoExchange(data, sampleRate, 9.7, 1.12, 61);
  renderV34RangingExchange(data, sampleRate, 10.98);
  renderFastHandshakeWarble(data, sampleRate, 12.28, 0.12, 0.058, 151);
  renderV34LineProbe(data, sampleRate, 12.42, 0.14, 0.13);
  renderLineClick(data, sampleRate, 12.61, 0.022, 47);
  renderV34LineProbe(data, sampleRate, 12.78, 0.5, 0.062);
  renderV34InfoExchange(data, sampleRate, 13.56, 1.24, 139);
  renderV34FinalTraining(data, sampleRate, 15.08);
  renderLineClick(data, sampleRate, 24.96, 0.012, 59);
  applyTelephoneLine(data, sampleRate);

  return buffer;
}

function renderDtmfNumber(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  digits: string,
) {
  const tones: Record<string, [number, number]> = {
    '0': [941, 1336],
    '1': [697, 1209],
    '2': [697, 1336],
    '3': [697, 1477],
    '4': [770, 1209],
    '5': [770, 1336],
    '6': [770, 1477],
    '7': [852, 1209],
    '8': [852, 1336],
    '9': [852, 1477],
  };
  const digitSeconds = 0.084;
  const stepSeconds = 0.137;

  Array.from(digits).forEach((digit, index) => {
    const frequencies = tones[digit];

    if (!frequencies) {
      return;
    }

    renderTone(
      data,
      sampleRate,
      startSeconds + index * stepSeconds,
      digitSeconds,
      frequencies,
      0.135,
    );
  });
}

function renderV25CallingTone(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  bursts: number,
) {
  for (let index = 0; index < bursts; index += 1) {
    renderTone(
      data,
      sampleRate,
      startSeconds + index * 2.18,
      0.58,
      1300,
      0.05,
      {
        frequencyDriftHz: 0.45,
        frequencyDriftRateHz: 5.5,
      },
    );
  }
}

function renderV8MenuExchange(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
) {
  renderFskBurst(data, sampleRate, startSeconds, durationSeconds, {
    gain: 0.062,
    markFrequency: 980,
    seed: 83,
    spaceFrequency: 1180,
    symbolRate: 300,
  });
  renderFskBurst(
    data,
    sampleRate,
    startSeconds + 0.18,
    durationSeconds - 0.18,
    {
      gain: 0.052,
      markFrequency: 1650,
      seed: 127,
      spaceFrequency: 1850,
      symbolRate: 300,
    },
  );
}

function renderV34InfoExchange(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  seed: number,
) {
  renderDpskBurst(data, sampleRate, startSeconds, durationSeconds, {
    carrierFrequency: 1200,
    gain: 0.071,
    seed,
    symbolRate: 600,
  });
  renderDpskBurst(
    data,
    sampleRate,
    startSeconds + 0.045,
    durationSeconds - 0.045,
    {
      carrierFrequency: 2400,
      gain: 0.058,
      seed: seed + 41,
      symbolRate: 600,
    },
  );
  renderTone(
    data,
    sampleRate,
    startSeconds + 0.045,
    durationSeconds - 0.045,
    1800,
    0.022,
  );
}

function renderV34RangingExchange(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
) {
  const steps: {
    durationSeconds: number;
    kind: 'answer' | 'call' | 'silence';
  }[] = [
    { durationSeconds: 0.04, kind: 'silence' },
    { durationSeconds: 0.16, kind: 'answer' },
    { durationSeconds: 0.46, kind: 'call' },
    { durationSeconds: 0.15, kind: 'answer' },
    { durationSeconds: 0.42, kind: 'call' },
    { durationSeconds: 0.08, kind: 'answer' },
  ];
  let cursorSeconds = startSeconds;

  steps.forEach((step, index) => {
    if (step.kind === 'answer') {
      renderTone(
        data,
        sampleRate,
        cursorSeconds,
        step.durationSeconds,
        2400,
        0.105,
        index === 1 || index === 3 ? { phaseReverseSeconds: 0.23 } : {},
      );
      renderTone(
        data,
        sampleRate,
        cursorSeconds,
        step.durationSeconds,
        1800,
        0.043,
      );
    }

    if (step.kind === 'call') {
      renderTone(
        data,
        sampleRate,
        cursorSeconds,
        step.durationSeconds,
        1200,
        0.118,
        index === 2 || index === 4 ? { phaseReverseSeconds: 0.17 } : {},
      );
    }

    cursorSeconds += step.durationSeconds;
  });
}

function renderV34LineProbe(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  gain: number,
) {
  const frequencies = Array.from(
    { length: 25 },
    (_, index) => (index + 1) * 150,
  ).filter((frequency) => ![900, 1200, 1800, 2400].includes(frequency));

  renderTone(
    data,
    sampleRate,
    startSeconds,
    durationSeconds,
    frequencies,
    gain,
  );
}

function renderAnswerToneBroadening(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
) {
  renderTone(data, sampleRate, startSeconds, durationSeconds, 2100, 0.034, {
    amplitudeModulationDepth: 0.24,
    amplitudeModulationHz: 15,
    frequencyDriftHz: 9,
    frequencyDriftRateHz: 7.5,
    phaseReverseSeconds: 0.45,
  });
  renderTone(
    data,
    sampleRate,
    startSeconds + 0.16,
    durationSeconds - 0.16,
    [1740, 1860, 1980, 2220, 2340, 2460],
    0.026,
    {
      amplitudeModulationDepth: 0.35,
      amplitudeModulationHz: 21,
      frequencyDriftHz: 16,
      frequencyDriftRateHz: 11,
    },
  );
  renderFskBurst(
    data,
    sampleRate,
    startSeconds + 0.54,
    durationSeconds - 0.54,
    {
      gain: 0.036,
      markFrequency: 1300,
      seed: 71,
      spaceFrequency: 2100,
      symbolRate: 600,
    },
  );
  renderScrambledQam(data, sampleRate, startSeconds + 0.72, 0.86, {
    carrierFrequency: 2100,
    gain: 0.033,
    seed: 89,
    symbolRate: 1200,
  });
}

function renderV34FinalTraining(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
) {
  renderV34SSequence(data, sampleRate, startSeconds, 0.3, {
    carrierFrequency: 1800,
    gain: 0.062,
    symbolRate: 3000,
  });
  renderV34PpSequence(data, sampleRate, startSeconds + 0.32, {
    carrierFrequency: 1800,
    gain: 0.067,
    symbolRate: 3000,
  });
  renderPulseShapedQam(data, sampleRate, startSeconds + 0.44, 1.25, {
    carrierFrequency: 1800,
    constellationSize: 4,
    gain: 0.048,
    seed: 191,
    symbolRate: 3000,
  });
  renderProbeComb(data, sampleRate, startSeconds + 0.54, 1.03, 0.083, 17);
  renderMultiFskBurst(
    data,
    sampleRate,
    startSeconds + 1.77,
    1.82,
    [1200, 2400],
    0.102,
    600,
    139,
  );
  renderV34MpSequence(data, sampleRate, startSeconds + 1.7, 0.52, {
    carrierFrequency: 1800,
    gain: 0.044,
    seed: 229,
    symbolRate: 3000,
  });
  renderV34SSequence(data, sampleRate, startSeconds + 2.32, 0.24, {
    carrierFrequency: 1829,
    gain: 0.055,
    symbolRate: 3200,
  });
  renderPulseShapedQam(data, sampleRate, startSeconds + 2.58, 1.55, {
    carrierFrequency: 1829,
    constellationSize: 16,
    gain: 0.052,
    seed: 307,
    symbolRate: 3200,
  });
  renderMultiFskBurst(
    data,
    sampleRate,
    startSeconds + 3.77,
    3.25,
    [600, 960, 1440, 1920, 2400, 2880, 3200],
    0.078,
    1200,
    211,
  );
  renderV34MpSequence(data, sampleRate, startSeconds + 4.16, 0.52, {
    carrierFrequency: 1829,
    gain: 0.038,
    seed: 353,
    symbolRate: 3000,
  });
  renderPulseShapedQam(data, sampleRate, startSeconds + 4.82, 1.5, {
    carrierFrequency: 1920,
    constellationSize: 16,
    gain: 0.05,
    seed: 401,
    symbolRate: 3200,
  });
  renderCoarseSaturation(data, sampleRate, startSeconds + 0.5, 5.85, {
    drive: 2.35,
    mix: 0.34,
  });
  renderV34InfoExchange(data, sampleRate, startSeconds + 6.45, 0.72, 457);
  renderV34SSequence(data, sampleRate, startSeconds + 7.2, 0.2, {
    carrierFrequency: 1959,
    gain: 0.055,
    symbolRate: 3429,
  });
  renderBroadDataCrunch(data, sampleRate, startSeconds + 7.42, 1.5);
}

function renderV34SSequence(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    carrierFrequency,
    gain,
    symbolRate,
  }: {
    carrierFrequency: number;
    gain: number;
    symbolRate: number;
  },
) {
  renderPhaseSymbolSequence(data, sampleRate, startSeconds, durationSeconds, {
    carrierFrequency,
    gain,
    phases: [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2],
    symbolRate,
  });
}

function renderV34PpSequence(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  {
    carrierFrequency,
    gain,
    symbolRate,
  }: {
    carrierFrequency: number;
    gain: number;
    symbolRate: number;
  },
) {
  const durationSeconds = (48 * 6) / symbolRate;

  renderPhaseSymbolSequence(data, sampleRate, startSeconds, durationSeconds, {
    carrierFrequency,
    gain,
    phases: Array.from({ length: 48 }, (_, index) => {
      const k = Math.floor(index / 4);
      const i = index % 4;
      const numerator = k % 3 === 1 ? k * i + 4 : k * i;

      return (Math.PI * numerator) / 6;
    }),
    symbolRate,
  });
}

function renderV34MpSequence(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    carrierFrequency,
    gain,
    seed,
    symbolRate,
  }: {
    carrierFrequency: number;
    gain: number;
    seed: number;
    symbolRate: number;
  },
) {
  renderPulseShapedQam(data, sampleRate, startSeconds, durationSeconds, {
    carrierFrequency,
    constellationSize: 4,
    gain,
    seed,
    symbolRate,
  });
  renderTone(
    data,
    sampleRate,
    startSeconds,
    durationSeconds,
    carrierFrequency,
    gain * 0.18,
    {
      amplitudeModulationDepth: 0.18,
      amplitudeModulationHz: 27,
    },
  );
}

function renderBroadDataCrunch(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
) {
  renderPulseShapedQam(data, sampleRate, startSeconds, durationSeconds, {
    carrierFrequency: 1959,
    constellationSize: 16,
    gain: 0.072,
    seed: 503,
    symbolRate: 3429,
  });
  renderPulseShapedQam(
    data,
    sampleRate,
    startSeconds + 0.025,
    durationSeconds - 0.025,
    {
      carrierFrequency: 1680,
      constellationSize: 16,
      gain: 0.044,
      seed: 547,
      symbolRate: 2743,
    },
  );
  renderPulseShapedQam(
    data,
    sampleRate,
    startSeconds + 0.055,
    durationSeconds - 0.055,
    {
      carrierFrequency: 2280,
      constellationSize: 16,
      gain: 0.036,
      seed: 587,
      symbolRate: 3000,
    },
  );
  renderCoarseSaturation(data, sampleRate, startSeconds, durationSeconds, {
    drive: 2.7,
    mix: 0.46,
  });
}

function renderFastHandshakeWarble(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  gain: number,
  seed: number,
) {
  const lowFrequencies = [1050, 1150, 1200, 1300, 1450, 1600];
  const highFrequencies = [2400, 2550, 2700, 2850, 3000, 3150, 3300, 3450];
  const stepSeconds = HANDSHAKE_STEP_SECONDS;
  let cursorSeconds = startSeconds;
  let state = seed;
  let useHighBand = false;

  while (cursorSeconds < startSeconds + durationSeconds - stepSeconds) {
    state = nextNoiseState(state);
    useHighBand = !useHighBand;

    const frequencies = useHighBand ? highFrequencies : lowFrequencies;
    const primary = frequencies[state % frequencies.length] ?? frequencies[0];
    const secondary =
      frequencies[(state >>> 8) % frequencies.length] ?? frequencies[1];

    renderTone(
      data,
      sampleRate,
      cursorSeconds,
      stepSeconds,
      [primary ?? 1200, secondary ?? 2400],
      gain,
    );
    cursorSeconds += stepSeconds;
  }
}

function renderProbeComb(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  gain: number,
  seed: number,
) {
  const frequencies = [420, 620, 860, 1180, 1620, 2200, 2860, 3200];
  const chirpSeconds = 0.08;
  const gapSeconds = 0.035;
  let cursorSeconds = startSeconds;
  let state = seed;

  while (cursorSeconds < startSeconds + durationSeconds - chirpSeconds) {
    state = nextNoiseState(state);
    renderTone(
      data,
      sampleRate,
      cursorSeconds,
      chirpSeconds,
      frequencies[state % frequencies.length] ?? frequencies[0] ?? 420,
      gain,
    );
    cursorSeconds += chirpSeconds + gapSeconds;
  }
}

function renderPhaseSymbolSequence(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    carrierFrequency,
    gain,
    phases,
    symbolRate,
  }: {
    carrierFrequency: number;
    gain: number;
    phases: number[];
    symbolRate: number;
  },
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const symbolSamples = Math.max(1, Math.round(sampleRate / symbolRate));
  let symbolIndex = 0;
  let targetInPhase = 1;
  let targetQuadrature = 0;
  let inPhase = targetInPhase;
  let quadrature = targetQuadrature;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    if ((sample - startSample) % symbolSamples === 0) {
      const phase = phases[symbolIndex % phases.length] ?? 0;

      targetInPhase = Math.cos(phase);
      targetQuadrature = Math.sin(phase);
      symbolIndex += 1;
    }

    inPhase += (targetInPhase - inPhase) * 0.36;
    quadrature += (targetQuadrature - quadrature) * 0.36;

    const carrierPhase = TWO_PI * carrierFrequency * elapsedSeconds;
    const sampleValue =
      inPhase * Math.cos(carrierPhase) - quadrature * Math.sin(carrierPhase);

    data[sample] =
      (data[sample] ?? 0) +
      sampleValue *
        gain *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderPulseShapedQam(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    carrierFrequency,
    constellationSize,
    gain,
    seed,
    symbolRate,
  }: {
    carrierFrequency: number;
    constellationSize: 4 | 16;
    gain: number;
    seed: number;
    symbolRate: number;
  },
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const symbolSamples = Math.max(1, Math.round(sampleRate / symbolRate));
  const levels = constellationSize === 4 ? [-1, 1] : [-3, -1, 1, 3];
  const levelScale = constellationSize === 4 ? 1 : 3;
  let state = seed;
  let targetInPhase = 1;
  let targetQuadrature = -1;
  let inPhase = targetInPhase;
  let quadrature = targetQuadrature;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    if ((sample - startSample) % symbolSamples === 0) {
      state = nextScramblerState(state);

      const inPhaseIndex = constellationSize === 4 ? state & 1 : state & 3;
      const quadratureIndex =
        constellationSize === 4 ? (state >>> 3) & 1 : (state >>> 5) & 3;

      targetInPhase = (levels[inPhaseIndex] ?? levels[0] ?? 1) / levelScale;
      targetQuadrature =
        (levels[quadratureIndex] ?? levels[1] ?? -1) / levelScale;
    }

    inPhase += (targetInPhase - inPhase) * 0.24;
    quadrature += (targetQuadrature - quadrature) * 0.24;

    const carrierJitter =
      0.55 * Math.sin(TWO_PI * 3.1 * elapsedSeconds + seed * 0.017);
    const carrierPhase =
      TWO_PI * (carrierFrequency + carrierJitter) * elapsedSeconds +
      seed * 0.003;
    const sampleValue =
      inPhase * Math.cos(carrierPhase) - quadrature * Math.sin(carrierPhase);

    data[sample] =
      (data[sample] ?? 0) +
      sampleValue *
        gain *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderCoarseSaturation(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    drive,
    mix,
  }: {
    drive: number;
    mix: number;
  },
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;
    const currentSample = data[sample] ?? 0;
    const shapedSample = Math.tanh(currentSample * drive) / Math.tanh(drive);
    const lowRateModulation =
      0.78 + 0.22 * Math.sin(TWO_PI * 34 * elapsedSeconds);
    const amount =
      mix *
      lowRateModulation *
      envelope(elapsedSeconds, durationSeconds, sampleRate);

    data[sample] = currentSample * (1 - amount) + shapedSample * amount;
  }
}

function renderFskBurst(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    gain,
    markFrequency,
    seed,
    spaceFrequency,
    symbolRate,
  }: {
    gain: number;
    markFrequency: number;
    seed: number;
    spaceFrequency: number;
    symbolRate: number;
  },
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const symbolSamples = Math.max(1, Math.round(sampleRate / symbolRate));
  let phase = 0;
  let state = seed;
  let frequency = markFrequency;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    if ((sample - startSample) % symbolSamples === 0) {
      state = nextNoiseState(state);
      frequency = (state & 0x20000000) === 0 ? markFrequency : spaceFrequency;
    }

    phase += (TWO_PI * frequency) / sampleRate;
    data[sample] =
      (data[sample] ?? 0) +
      Math.sin(phase) *
        gain *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderMultiFskBurst(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  frequencies: number[],
  gain: number,
  symbolRate: number,
  seed: number,
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const symbolSamples = Math.max(1, Math.round(sampleRate / symbolRate));
  let phase = 0;
  let state = seed;
  let frequency = frequencies[0] ?? 1200;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    if ((sample - startSample) % symbolSamples === 0) {
      state = nextNoiseState(state);
      frequency = frequencies[state % frequencies.length] ?? frequency;
    }

    phase += (TWO_PI * frequency) / sampleRate;
    data[sample] =
      (data[sample] ?? 0) +
      Math.sin(phase) *
        gain *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderDpskBurst(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    carrierFrequency,
    gain,
    seed,
    symbolRate,
  }: {
    carrierFrequency: number;
    gain: number;
    seed: number;
    symbolRate: number;
  },
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const symbolSamples = Math.max(1, Math.round(sampleRate / symbolRate));
  let state = seed;
  let phaseOffset = (seed % 23) / 23;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    if ((sample - startSample) % symbolSamples === 0) {
      state = nextNoiseState(state);

      if ((state & 0x80000000) !== 0) {
        phaseOffset += Math.PI;
      }
    }

    data[sample] =
      (data[sample] ?? 0) +
      Math.sin(TWO_PI * carrierFrequency * elapsedSeconds + phaseOffset) *
        gain *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderScrambledQam(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  {
    carrierFrequency,
    gain,
    seed,
    symbolRate,
  }: {
    carrierFrequency: number;
    gain: number;
    seed: number;
    symbolRate: number;
  },
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const symbolSamples = Math.max(1, Math.round(sampleRate / symbolRate));
  const levels = [-3, -1, 1, 3];
  let state = seed;
  let inPhase = 1;
  let quadrature = -1;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    if ((sample - startSample) % symbolSamples === 0) {
      state = nextNoiseState(state);
      inPhase = (levels[state & 3] ?? 1) / 3;
      quadrature = (levels[(state >>> 5) & 3] ?? -1) / 3;
    }

    const drift = 1.8 * Math.sin(TWO_PI * 2.1 * elapsedSeconds + seed * 0.013);
    const carrierPhase =
      TWO_PI * (carrierFrequency + drift) * elapsedSeconds + seed * 0.007;
    const sampleValue =
      inPhase * Math.cos(carrierPhase) - quadrature * Math.sin(carrierPhase);

    data[sample] =
      (data[sample] ?? 0) +
      sampleValue *
        gain *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderTone(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  frequencies: number | number[],
  gain: number,
  options: ToneOptions = {},
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  const toneFrequencies = Array.isArray(frequencies)
    ? frequencies
    : [frequencies];

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;
    const phaseSign =
      options.phaseReverseSeconds &&
      Math.floor(elapsedSeconds / options.phaseReverseSeconds) % 2 === 1
        ? -1
        : 1;
    const amplitudeModulation =
      options.amplitudeModulationHz && options.amplitudeModulationDepth
        ? 1 +
          options.amplitudeModulationDepth *
            Math.sin(TWO_PI * options.amplitudeModulationHz * elapsedSeconds)
        : 1;
    const frequencyDrift =
      options.frequencyDriftHz && options.frequencyDriftRateHz
        ? options.frequencyDriftHz *
          Math.sin(TWO_PI * options.frequencyDriftRateHz * elapsedSeconds)
        : 0;
    const sampleValue =
      toneFrequencies.reduce((sum, frequency) => {
        const safeFrequency = clamp(
          frequency + frequencyDrift,
          40,
          DIAL_UP_MAX_FREQUENCY_HZ,
        );

        return (
          sum + Math.sin(TWO_PI * safeFrequency * elapsedSeconds) * phaseSign
        );
      }, 0) / toneFrequencies.length;

    data[sample] =
      (data[sample] ?? 0) +
      sampleValue *
        gain *
        amplitudeModulation *
        envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderLineNoise(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  gain: number,
  seed: number,
) {
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  let state = seed;
  let lastNoise = 0;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    state = nextNoiseState(state);

    const white = (state / 0xffffffff) * 2 - 1;
    const crackle =
      (state & 0x3fff) === 0 ? ((state >>> 14) / 0x3ffff) * 2 - 1 : 0;
    const noise = white - lastNoise + crackle * 1.4;

    lastNoise = white;
    data[sample] =
      (data[sample] ?? 0) +
      noise * gain * envelope(elapsedSeconds, durationSeconds, sampleRate);
  }
}

function renderLineClick(
  data: Float32Array,
  sampleRate: number,
  startSeconds: number,
  gain: number,
  seed: number,
) {
  const durationSeconds = 0.028;
  const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endSample = Math.min(
    data.length,
    Math.floor((startSeconds + durationSeconds) * sampleRate),
  );
  let state = seed;

  for (let sample = startSample; sample < endSample; sample += 1) {
    const elapsedSeconds = (sample - startSample) / sampleRate;

    state = nextNoiseState(state);

    const decay = Math.exp(-elapsedSeconds * 95);
    const noise = (state / 0xffffffff) * 2 - 1;

    data[sample] =
      (data[sample] ?? 0) +
      (noise * 0.7 + Math.sin(TWO_PI * 1220 * elapsedSeconds) * 0.3) *
        gain *
        decay;
  }
}

function applyTelephoneLine(data: Float32Array, sampleRate: number) {
  const highPassCutoffHz = 245;
  const lowPassCutoffHz = 3675;
  const highPassAlpha = 1 / (1 + TWO_PI * highPassCutoffHz * (1 / sampleRate));
  const lowPassAlpha =
    (TWO_PI * lowPassCutoffHz * (1 / sampleRate)) /
    (1 + TWO_PI * lowPassCutoffHz * (1 / sampleRate));
  let lowPass = 0;
  let previousInput = 0;
  let highPass = 0;
  let peak = 0;

  for (let index = 0; index < data.length; index += 1) {
    const input = data[index] ?? 0;

    highPass = highPassAlpha * (highPass + input - previousInput);
    previousInput = input;
    lowPass += lowPassAlpha * (highPass - lowPass);
    data[index] = Math.tanh(lowPass * 1.35) / 1.22;
    peak = Math.max(peak, Math.abs(data[index] ?? 0));
  }

  const scale = peak > 0 ? Math.min(0.94 / peak, 1) : 1;

  for (let index = 0; index < data.length; index += 1) {
    data[index] = (data[index] ?? 0) * scale;
  }
}

function envelope(
  elapsedSeconds: number,
  durationSeconds: number,
  sampleRate: number,
) {
  const fadeSeconds = Math.min(0.012, durationSeconds / 3);
  const fadeSamples = Math.max(1, fadeSeconds * sampleRate);
  const elapsedSamples = elapsedSeconds * sampleRate;
  const remainingSamples = (durationSeconds - elapsedSeconds) * sampleRate;

  return Math.min(
    1,
    elapsedSamples / fadeSamples,
    remainingSamples / fadeSamples,
  );
}

function nextNoiseState(state: number) {
  return (state * 1664525 + 1013904223) >>> 0;
}

function nextScramblerState(state: number) {
  const bit =
    ((state >>> 22) ^ (state >>> 17) ^ (state >>> 4) ^ (state >>> 0)) & 1;

  return ((state << 1) | bit) >>> 0;
}
