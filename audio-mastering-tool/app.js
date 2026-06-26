import { bufferToWav } from './wav-exporter.js';

// ==========================================================================
// SYSTEM DIAGNOSTICS & LOGGER
// ==========================================================================
function logToUI(msg, type = 'info') {
  const logContainer = document.getElementById('debug-log');
  if (logContainer) {
    const line = document.createElement('div');
    line.style.color = type === 'error' ? '#ff0055' : type === 'warning' ? '#f77f00' : '#00f2fe';
    line.innerText = `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${msg}`;
    logContainer.appendChild(line);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

window.onerror = function(message, source, lineno, colno, error) {
  const file = source ? source.substring(source.lastIndexOf('/') + 1) : 'unknown';
  logToUI(`${message} (${file}:${lineno}:${colno})`, 'error');
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  logToUI(`Promise rejection: ${event.reason}`, 'error');
});

const originalConsoleError = console.error;
console.error = function(...args) {
  logToUI(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error');
  originalConsoleError.apply(console, args);
};

// ==========================================================================
// STATE MANAGEMENT & GLOBALS
// ==========================================================================
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;

// Playback state
let isPlaying = false;
let isLooping = false;
let isBypassed = false;
let isSeeking = false;
let startTime = 0;
let pausedAt = 0;
let playbackOffset = 0; // Current time position in track

// Downsampled peaks for waveform compare
let originalPeaks = null;
let cachedProcessedPeaks = null;
let baseLoudnessTarget = 'genre';
const PEAK_POINTS = 800;

// Web Audio API Nodes for active playback
let activeNodes = {
  inputGain: null,
  satDryGain: null,
  satWetGain: null,
  waveShaper: null,
  eqLow: null,
  eqMid: null,
  eqHigh: null,
  eqCorrective1: null, // AI corrective EQ notch filter 1
  eqCorrective2: null, // AI corrective EQ notch filter 2
  eqCorrective3: null, // AI corrective EQ notch filter 3
  eqCorrective4: null, // AI corrective EQ notch filter 4
  eqCorrective5: null, // AI corrective EQ notch filter 5
  eqCorrective6: null, // AI corrective EQ notch filter 6
  eqCorrective7: null, // AI corrective EQ notch filter 7
  eqCorrective8: null, // AI corrective EQ notch filter 8
  compressor: null,
  midGain: null,
  sideGain: null,
  limiterGain: null,
  limiter: null,
  ceilingGain: null,
  masteredOutGain: null,
  bypassGain: null,
  
  // Analysers
  inputSplitter: null,
  inputAnalyserL: null,
  inputAnalyserR: null,
  outputSplitter: null,
  outputAnalyserL: null,
  outputAnalyserR: null,
  visualAnalyser: null
};

// Mastering Parameters
const params = {
  inputGainDb: 0.0,
  ceiling: -1.0,
  
  // AI Corrective Notches (up to 8)
  correctiveNotches: [
    { freq: 9000, gain: 0.0, enabled: false },
    { freq: 7500, gain: 0.0, enabled: false },
    { freq: 11000, gain: 0.0, enabled: false },
    { freq: 6500, gain: 0.0, enabled: false },
    { freq: 9500, gain: 0.0, enabled: false },
    { freq: 8000, gain: 0.0, enabled: false },
    { freq: 10500, gain: 0.0, enabled: false },
    { freq: 7000, gain: 0.0, enabled: false }
  ],
  
  // Saturator
  satEnabled: true,
  satType: 'tube',
  satDrive: 15,
  satMix: 30,
  
  // EQ
  eqLowGain: 1.0,
  eqLowFreq: 120,
  eqMidGain: -0.5,
  eqMidFreq: 1000,
  eqHighGain: 1.5,
  eqHighFreq: 10000,
  
  // Compressor
  compEnabled: true,
  compThreshold: -16.0,
  compRatio: 1.8,
  compAttack: 0.03, // 30ms
  compRelease: 0.15, // 150ms
  
  // Stereo Width
  stereoWidth: 1.20, // 120%
  
  // Limiter/Maximizer
  limiterBoost: 4.0 // +4.0 dB
};

// Genre Presets Configuration
const GENRE_PRESETS = {
  auto: {
    satEnabled: true, satType: 'tape', satDrive: 15, satMix: 20,
    eqLowGain: 0.0, eqLowFreq: 120,
    eqMidGain: 0.0, eqMidFreq: 1000,
    eqHighGain: 0.0, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -15.0, compRatio: 1.6, compAttack: 0.03, compRelease: 0.15,
    stereoWidth: 1.15, limiterBoost: 3.5
  },
  pops: {
    satEnabled: true, satType: 'tube', satDrive: 12, satMix: 20,
    eqLowGain: 1.0, eqLowFreq: 120,
    eqMidGain: -0.5, eqMidFreq: 1000,
    eqHighGain: 1.5, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -16.0, compRatio: 1.8, compAttack: 0.03, compRelease: 0.15,
    stereoWidth: 1.20, limiterBoost: 3.8
  },
  rnb: {
    satEnabled: true, satType: 'tape', satDrive: 15, satMix: 18,
    eqLowGain: 1.5, eqLowFreq: 80,
    eqMidGain: -0.5, eqMidFreq: 1000,
    eqHighGain: 1.5, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -15.0, compRatio: 1.8, compAttack: 0.03, compRelease: 0.15,
    stereoWidth: 1.20, limiterBoost: 4.8
  },
  rock: {
    satEnabled: true, satType: 'tape', satDrive: 22, satMix: 25,
    eqLowGain: 1.2, eqLowFreq: 100,
    eqMidGain: 1.0, eqMidFreq: 2500,
    eqHighGain: 1.0, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -18.0, compRatio: 2.5, compAttack: 0.05, compRelease: 0.10,
    stereoWidth: 1.10, limiterBoost: 5.5
  },
  metal: {
    satEnabled: true, satType: 'tape', satDrive: 25, satMix: 25,
    eqLowGain: 1.0, eqLowFreq: 90,
    eqMidGain: -0.8, eqMidFreq: 400,
    eqHighGain: 1.5, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -16.0, compRatio: 2.2, compAttack: 0.015, compRelease: 0.08,
    stereoWidth: 1.15, limiterBoost: 6.8
  },
  edm: {
    satEnabled: true, satType: 'tape', satDrive: 18, satMix: 22,
    eqLowGain: 1.8, eqLowFreq: 90,
    eqMidGain: -0.5, eqMidFreq: 800,
    eqHighGain: 2.0, eqHighFreq: 11000,
    compEnabled: true, compThreshold: -15.0, compRatio: 2.2, compAttack: 0.015, compRelease: 0.12,
    stereoWidth: 1.30, limiterBoost: 6.5
  },
  hiphop: {
    satEnabled: true, satType: 'tape', satDrive: 18, satMix: 15,
    eqLowGain: 1.8, eqLowFreq: 65,
    eqMidGain: -0.8, eqMidFreq: 350,
    eqHighGain: 1.2, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -15.0, compRatio: 2.0, compAttack: 0.05, compRelease: 0.12,
    stereoWidth: 1.20, limiterBoost: 5.8
  },
  lofi: {
    satEnabled: true, satType: 'tape', satDrive: 45, satMix: 40,
    eqLowGain: 2.0, eqLowFreq: 150,
    eqMidGain: 0.5, eqMidFreq: 1200,
    eqHighGain: -1.5, eqHighFreq: 9000,
    compEnabled: true, compThreshold: -13.0, compRatio: 1.4, compAttack: 0.06, compRelease: 0.30,
    stereoWidth: 1.10, limiterBoost: 3.0
  },
  hardcore: {
    satEnabled: true, satType: 'hardcore', satDrive: 30, satMix: 30,
    eqLowGain: 2.2, eqLowFreq: 80,
    eqMidGain: -1.0, eqMidFreq: 1000,
    eqHighGain: 2.5, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -22.0, compRatio: 4.0, compAttack: 0.01, compRelease: 0.08,
    stereoWidth: 1.40, limiterBoost: 7.0
  },
  ambient: {
    satEnabled: true, satType: 'tube', satDrive: 5, satMix: 15,
    eqLowGain: 1.5, eqLowFreq: 90,
    eqMidGain: 0.0, eqMidFreq: 1000,
    eqHighGain: 2.0, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -12.0, compRatio: 1.2, compAttack: 0.15, compRelease: 0.40,
    stereoWidth: 1.60, limiterBoost: 2.0
  },
  podcast: {
    satEnabled: true, satType: 'tube', satDrive: 5, satMix: 10,
    eqLowGain: -2.0, eqLowFreq: 80,
    eqMidGain: 0.8, eqMidFreq: 1500,
    eqHighGain: 0.5, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -18.0, compRatio: 3.0, compAttack: 0.02, compRelease: 0.15,
    stereoWidth: 1.00, limiterBoost: 4.5
  },
  classic: {
    satEnabled: false, satType: 'tube', satDrive: 10, satMix: 0,
    eqLowGain: 0.0, eqLowFreq: 100,
    eqMidGain: 0.0, eqMidFreq: 1000,
    eqHighGain: 0.0, eqHighFreq: 10000,
    compEnabled: false, compThreshold: -5.0, compRatio: 1.1, compAttack: 0.20, compRelease: 0.50,
    stereoWidth: 1.00, limiterBoost: 0.0
  },
  jazz: {
    satEnabled: true, satType: 'tube', satDrive: 20, satMix: 25,
    eqLowGain: 1.5, eqLowFreq: 200,
    eqMidGain: 0.5, eqMidFreq: 1000,
    eqHighGain: 0.5, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -14.0, compRatio: 1.5, compAttack: 0.08, compRelease: 0.25,
    stereoWidth: 1.05, limiterBoost: 2.5
  },
  acoustic: {
    satEnabled: true, satType: 'tube', satDrive: 8, satMix: 8,
    eqLowGain: 0.5, eqLowFreq: 100,
    eqMidGain: 0.5, eqMidFreq: 1000,
    eqHighGain: 1.0, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -10.0, compRatio: 1.3, compAttack: 0.08, compRelease: 0.25,
    stereoWidth: 1.25, limiterBoost: 1.5
  }
};

// Loudness Targets
const LOUDNESS_TARGETS = {
  genre: { boost: null },     // Genre Default (follows selected preset)
  streaming: { boost: 4.0 },  // Standard Streaming -14 LUFS target
  club: { boost: 7.0 },       // Standard Club -9 LUFS target
  loud: { boost: 10.0 },      // Standard Heavy -7 LUFS target
  pure: { boost: 0.0 }        // High Dynamic Range -18 LUFS target
};

// Level meter decay values
let meterInPeakL = -60;
let meterInPeakR = -60;
let meterOutPeakL = -60;
let meterOutPeakR = -60;
let grPeak = 0;
let correlationValue = 1.0;

// Visualizer animation frame
let animFrameId = null;
let activeTab = 'spectrum'; // 'spectrum' or 'waveform'

// ==========================================================================
// SATURATOR CURVE GENERATOR
// ==========================================================================
function generateSaturatorCurve(type, drive) {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  
  if (type === 'tube') {
    // Asymmetric soft distortion (vacuum tube even harmonics)
    const k = 0.5 + (drive / 100) * 8.5; // range 0.5 to 9.0
    const offset = 0.12; // asymmetry offset
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      const x_off = x + offset;
      const y = Math.tanh(k * x_off);
      // Subtract DC offset to keep zero-crossing centered
      curve[i] = y - Math.tanh(k * offset);
    }
    
    // 範囲[-1.0, 1.0]に正規化し、デジタルクリッピングノイズを防ぐ
    let maxVal = 0;
    for (let i = 0; i < n_samples; ++i) {
      const absVal = Math.abs(curve[i]);
      if (absVal > maxVal) maxVal = absVal;
    }
    if (maxVal > 0) {
      for (let i = 0; i < n_samples; ++i) {
        curve[i] /= maxVal;
      }
    }
  } else if (type === 'tape') {
    // Symmetric soft clipping (analog tape odd harmonics)
    const k = 0.5 + (drive / 100) * 5.5; // range 0.5 to 6.0
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
  } else if (type === 'hardcore') {
    // Hard clipping / Overdrive
    const k = 1.0 + (drive / 100) * 14.0; // gain factor
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      const val = x * k;
      // Hard clamp with soft knee transition
      curve[i] = Math.max(-0.82, Math.min(0.82, val));
    }
  } else {
    // Linear (Bypass)
    for (let i = 0; i < n_samples; ++i) {
      curve[i] = (i * 2) / n_samples - 1;
    }
  }
  return curve;
}

// ==========================================================================
// SIGNAL CHAIN CREATION FUNCTION
// ==========================================================================
function setupMasteringChain(context, sourceNode, parameters, customDestination = null) {
  const dest = customDestination || context.destination;

  // 1. Input Gain Node
  const inputGainNode = context.createGain();
  inputGainNode.gain.setValueAtTime(Math.pow(10, parameters.inputGainDb / 20), context.currentTime);

  // 2. Parallel Saturator Stage
  const satDryGain = context.createGain();
  const satWetGain = context.createGain();
  const waveShaper = context.createWaveShaper();
  const satSumNode = context.createGain();

  waveShaper.curve = generateSaturatorCurve(parameters.satType, parameters.satDrive);
  waveShaper.oversample = 'none'; // フィルター遅延による位相干渉（コームフィルター）を防ぐため、オーバーサンプリングを無効化します。

  if (parameters.satEnabled) {
    const blend = parameters.satMix / 100;
    satDryGain.gain.setValueAtTime(1.0 - 0.3 * blend, context.currentTime);
    satWetGain.gain.setValueAtTime(blend, context.currentTime);
  } else {
    satDryGain.gain.setValueAtTime(1.0, context.currentTime);
    satWetGain.gain.setValueAtTime(0.0, context.currentTime);
  }

  // Hook up parallel saturator
  inputGainNode.connect(satDryGain);
  inputGainNode.connect(waveShaper);
  waveShaper.connect(satWetGain);

  satDryGain.connect(satSumNode);
  satWetGain.connect(satSumNode);

  // 3. 3-Band Equalizer (Low Shelf, Mid Peaking, High Shelf)
  const eqLow = context.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.setValueAtTime(parameters.eqLowFreq, context.currentTime);
  eqLow.gain.setValueAtTime(parameters.eqLowGain, context.currentTime);

  const eqMid = context.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.Q.setValueAtTime(1.0, context.currentTime);
  eqMid.frequency.setValueAtTime(parameters.eqMidFreq, context.currentTime);
  eqMid.gain.setValueAtTime(parameters.eqMidGain, context.currentTime);

  const eqHigh = context.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.setValueAtTime(parameters.eqHighFreq, context.currentTime);
  eqHigh.gain.setValueAtTime(parameters.eqHighGain, context.currentTime);

  // 8連 AI Corrective Notch Filters
  const eqCorrective1 = context.createBiquadFilter();
  eqCorrective1.type = 'peaking';
  eqCorrective1.Q.setValueAtTime(6.0, context.currentTime); // 狭いQ値
  eqCorrective1.frequency.setValueAtTime(parameters.correctiveNotches[0].freq, context.currentTime);
  eqCorrective1.gain.setValueAtTime(parameters.correctiveNotches[0].enabled ? parameters.correctiveNotches[0].gain : 0.0, context.currentTime);

  const eqCorrective2 = context.createBiquadFilter();
  eqCorrective2.type = 'peaking';
  eqCorrective2.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective2.frequency.setValueAtTime(parameters.correctiveNotches[1].freq, context.currentTime);
  eqCorrective2.gain.setValueAtTime(parameters.correctiveNotches[1].enabled ? parameters.correctiveNotches[1].gain : 0.0, context.currentTime);

  const eqCorrective3 = context.createBiquadFilter();
  eqCorrective3.type = 'peaking';
  eqCorrective3.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective3.frequency.setValueAtTime(parameters.correctiveNotches[2].freq, context.currentTime);
  eqCorrective3.gain.setValueAtTime(parameters.correctiveNotches[2].enabled ? parameters.correctiveNotches[2].gain : 0.0, context.currentTime);

  const eqCorrective4 = context.createBiquadFilter();
  eqCorrective4.type = 'peaking';
  eqCorrective4.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective4.frequency.setValueAtTime(parameters.correctiveNotches[3].freq, context.currentTime);
  eqCorrective4.gain.setValueAtTime(parameters.correctiveNotches[3].enabled ? parameters.correctiveNotches[3].gain : 0.0, context.currentTime);

  const eqCorrective5 = context.createBiquadFilter();
  eqCorrective5.type = 'peaking';
  eqCorrective5.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective5.frequency.setValueAtTime(parameters.correctiveNotches[4].freq, context.currentTime);
  eqCorrective5.gain.setValueAtTime(parameters.correctiveNotches[4].enabled ? parameters.correctiveNotches[4].gain : 0.0, context.currentTime);

  const eqCorrective6 = context.createBiquadFilter();
  eqCorrective6.type = 'peaking';
  eqCorrective6.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective6.frequency.setValueAtTime(parameters.correctiveNotches[5].freq, context.currentTime);
  eqCorrective6.gain.setValueAtTime(parameters.correctiveNotches[5].enabled ? parameters.correctiveNotches[5].gain : 0.0, context.currentTime);

  const eqCorrective7 = context.createBiquadFilter();
  eqCorrective7.type = 'peaking';
  eqCorrective7.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective7.frequency.setValueAtTime(parameters.correctiveNotches[6].freq, context.currentTime);
  eqCorrective7.gain.setValueAtTime(parameters.correctiveNotches[6].enabled ? parameters.correctiveNotches[6].gain : 0.0, context.currentTime);

  const eqCorrective8 = context.createBiquadFilter();
  eqCorrective8.type = 'peaking';
  eqCorrective8.Q.setValueAtTime(6.0, context.currentTime);
  eqCorrective8.frequency.setValueAtTime(parameters.correctiveNotches[7].freq, context.currentTime);
  eqCorrective8.gain.setValueAtTime(parameters.correctiveNotches[7].enabled ? parameters.correctiveNotches[7].gain : 0.0, context.currentTime);

  satSumNode.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(eqCorrective1);
  eqCorrective1.connect(eqCorrective2);
  eqCorrective2.connect(eqCorrective3);
  eqCorrective3.connect(eqCorrective4);
  eqCorrective4.connect(eqCorrective5);
  eqCorrective5.connect(eqCorrective6);
  eqCorrective6.connect(eqCorrective7);
  eqCorrective7.connect(eqCorrective8);

  // 4. Glue Compressor
  const compressor = context.createDynamicsCompressor();
  compressor.knee.setValueAtTime(6.0, context.currentTime); // Soft knee

  if (parameters.compEnabled) {
    compressor.threshold.setValueAtTime(parameters.compThreshold, context.currentTime);
    compressor.ratio.setValueAtTime(parameters.compRatio, context.currentTime);
    compressor.attack.setValueAtTime(parameters.compAttack, context.currentTime);
    compressor.release.setValueAtTime(parameters.compRelease, context.currentTime);
  } else {
    compressor.threshold.setValueAtTime(0.0, context.currentTime);
    compressor.ratio.setValueAtTime(1.0, context.currentTime); // 1:1 ratio = Bypassed dynamics
  }

  eqCorrective8.connect(compressor);

  // 5. Stereo Imager Matrix (Mid/Side Processing)
  const splitter = context.createChannelSplitter(2);
  const midSum = context.createGain();
  const sideDiff = context.createGain();

  const leftToMid = context.createGain(); leftToMid.gain.setValueAtTime(0.5, context.currentTime);
  const rightToMid = context.createGain(); rightToMid.gain.setValueAtTime(0.5, context.currentTime);
  const leftToSide = context.createGain(); leftToSide.gain.setValueAtTime(0.5, context.currentTime);
  const rightToSide = context.createGain(); rightToSide.gain.setValueAtTime(-0.5, context.currentTime);

  compressor.connect(splitter);

  // Map L/R to Mid-Side
  splitter.connect(leftToMid, 0); // L
  splitter.connect(rightToMid, 1); // R
  leftToMid.connect(midSum);
  rightToMid.connect(midSum);

  splitter.connect(leftToSide, 0); // L
  splitter.connect(rightToSide, 1); // R
  leftToSide.connect(sideDiff);
  rightToSide.connect(sideDiff);

  // Stereo Width Gain Nodes
  const midGain = context.createGain();
  const sideGain = context.createGain();
  
  // 低域の位相干渉（シュワシュワ音）を防ぐため、Side信号の200Hz以下をカットするハイパスフィルター
  const sideHighPass = context.createBiquadFilter();
  sideHighPass.type = 'highpass';
  sideHighPass.frequency.setValueAtTime(200, context.currentTime); // 200Hz以下はモノラル（Midのみ）に維持
  sideHighPass.Q.setValueAtTime(0.707, context.currentTime);

  const w = parameters.stereoWidth;
  // センター音（ボーカルやベースなど）の定位と音量を維持するため、Midゲインは1.0に固定します。
  midGain.gain.setValueAtTime(1.0, context.currentTime);
  sideGain.gain.setValueAtTime(w, context.currentTime);

  midSum.connect(midGain);
  
  // Side信号はハイパスを通した後に広がりを適用
  sideDiff.connect(sideHighPass);
  sideHighPass.connect(sideGain);

  // Decode back to Stereo L/R
  const leftSum = context.createGain();
  const rightDiff = context.createGain();
  const sideInverter = context.createGain();
  sideInverter.gain.setValueAtTime(-1.0, context.currentTime);

  midGain.connect(leftSum);
  sideGain.connect(leftSum); // L = Mid + Side

  midGain.connect(rightDiff);
  sideGain.connect(sideInverter);
  sideInverter.connect(rightDiff); // R = Mid - Side

  const merger = context.createChannelMerger(2);
  leftSum.connect(merger, 0, 0);
  rightDiff.connect(merger, 0, 1);

  // 6. Limiter pre-gain (Maximizer)
  const limiterGain = context.createGain();
  limiterGain.gain.setValueAtTime(Math.pow(10, parameters.limiterBoost / 20), context.currentTime);

  merger.connect(limiterGain);

  // 7. Brickwall Limiter
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(0.0, context.currentTime); // Clip threshold
  limiter.knee.setValueAtTime(0.0, context.currentTime);      // Hard knee
  limiter.ratio.setValueAtTime(20.0, context.currentTime);    // Dynamic limiting brickwall
  limiter.attack.setValueAtTime(0.001, context.currentTime);  // 1ms
  limiter.release.setValueAtTime(0.08, context.currentTime);  // 80ms (optimized to prevent low-end distortion)

  limiterGain.connect(limiter);

  // 8. Ceiling Gain Node
  const ceilingGain = context.createGain();
  ceilingGain.gain.setValueAtTime(Math.pow(10, parameters.ceiling / 20), context.currentTime);

  limiter.connect(ceilingGain);
  ceilingGain.connect(dest);

  // Connect Input Source to chain entry
  sourceNode.connect(inputGainNode);

  return {
    outputNode: ceilingGain,
    inputGain: inputGainNode,
    satDryGain,
    satWetGain,
    waveShaper,
    eqLow,
    eqMid,
    eqHigh,
    eqCorrective1,
    eqCorrective2,
    eqCorrective3,
    eqCorrective4,
    eqCorrective5,
    eqCorrective6,
    eqCorrective7,
    eqCorrective8,
    compressor,
    midGain,
    sideGain,
    limiterGain,
    limiter,
    ceilingGain
  };
}

// ==========================================================================
// PLAYER & ENGINE INITIALIZATION
// ==========================================================================
function initAudio() {
  logToUI(`initAudio: State before init: ${audioContext ? audioContext.state : 'null'}`, 'info');
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    logToUI(`initAudio: Created new AudioContext. State: ${audioContext.state}`, 'info');
  }
  
  // Set audio session type to 'playback' for iOS/mobile background playback support (unmutes silent switch and keeps background running)
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
      logToUI(`initAudio: Set audioSession.type to 'playback' for background playback support.`, 'info');
    } catch (e) {
      logToUI(`initAudio: Failed to set audioSession.type: ${e.message}`, 'warning');
    }
  }

  if (audioContext.state === 'suspended') {
    logToUI(`initAudio: Resuming suspended AudioContext...`, 'info');
    audioContext.resume()
      .then(() => {
        logToUI(`initAudio: AudioContext resumed. State: ${audioContext.state}`, 'info');
      })
      .catch((err) => {
        logToUI(`initAudio: Resume failed: ${err.message}`, 'error');
      });
  } else {
    logToUI(`initAudio: AudioContext is already running. State: ${audioContext.state}`, 'info');
  }
}

function startPlayback() {
  logToUI(`startPlayback: Started. isPlaying=${isPlaying}, hasBuffer=${!!audioBuffer}`, 'info');
  if (!audioBuffer) return;
  
  initAudio();
  
  // Re-create BufferSource
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.loop = isLooping;
  
  // Track offset when finished
  sourceNode.onended = () => {
    if (isPlaying && !isLooping) {
      // Loop finished or playback stopped
      const elapsed = audioContext.currentTime - startTime;
      if (elapsed + pausedAt >= audioBuffer.duration) {
        stopPlayback();
      }
    }
  };

  // 1. Set up live level analysers
  const inputSplitter = audioContext.createChannelSplitter(2);
  const inputAnalyserL = audioContext.createAnalyser();
  const inputAnalyserR = audioContext.createAnalyser();
  inputAnalyserL.fftSize = 512;
  inputAnalyserR.fftSize = 512;
  
  const outputSplitter = audioContext.createChannelSplitter(2);
  const outputAnalyserL = audioContext.createAnalyser();
  const outputAnalyserR = audioContext.createAnalyser();
  outputAnalyserL.fftSize = 512;
  outputAnalyserR.fftSize = 512;

  const visualAnalyser = audioContext.createAnalyser();
  visualAnalyser.fftSize = 1024;

  // Track reference node mappings
  activeNodes.inputSplitter = inputSplitter;
  activeNodes.inputAnalyserL = inputAnalyserL;
  activeNodes.inputAnalyserR = inputAnalyserR;
  activeNodes.outputSplitter = outputSplitter;
  activeNodes.outputAnalyserL = outputAnalyserL;
  activeNodes.outputAnalyserR = outputAnalyserR;
  activeNodes.visualAnalyser = visualAnalyser;

  // 2. Build Bypass Crossfaders
  const masteredOutGain = audioContext.createGain();
  const bypassGain = audioContext.createGain();

  activeNodes.masteredOutGain = masteredOutGain;
  activeNodes.bypassGain = bypassGain;

  // 3. Build Main Mastering Chain
  const chain = setupMasteringChain(audioContext, sourceNode, params, masteredOutGain);
  
  // Connect references to let slider changes alter nodes in real time
  activeNodes.inputGain = chain.inputGain;
  activeNodes.satDryGain = chain.satDryGain;
  activeNodes.satWetGain = chain.satWetGain;
  activeNodes.waveShaper = chain.waveShaper;
  activeNodes.eqLow = chain.eqLow;
  activeNodes.eqMid = chain.eqMid;
  activeNodes.eqHigh = chain.eqHigh;
  activeNodes.eqCorrective1 = chain.eqCorrective1;
  activeNodes.eqCorrective2 = chain.eqCorrective2;
  activeNodes.eqCorrective3 = chain.eqCorrective3;
  activeNodes.eqCorrective4 = chain.eqCorrective4;
  activeNodes.eqCorrective5 = chain.eqCorrective5;
  activeNodes.eqCorrective6 = chain.eqCorrective6;
  activeNodes.eqCorrective7 = chain.eqCorrective7;
  activeNodes.eqCorrective8 = chain.eqCorrective8;
  activeNodes.compressor = chain.compressor;
  activeNodes.midGain = chain.midGain;
  activeNodes.sideGain = chain.sideGain;
  activeNodes.limiterGain = chain.limiterGain;
  activeNodes.limiter = chain.limiter;
  activeNodes.ceilingGain = chain.ceilingGain;

  // 4. Hook up Input monitoring (right after inputGain)
  chain.inputGain.connect(inputSplitter);
  inputSplitter.connect(inputAnalyserL, 0);
  inputSplitter.connect(inputAnalyserR, 1);

  // 5. Connect Bypass Node directly from source
  sourceNode.connect(bypassGain);

  // 6. Connect Outputs to Summing visualAnalyser and Speakers
  masteredOutGain.connect(visualAnalyser);
  bypassGain.connect(visualAnalyser);
  
  // Also connect to Level Analysers
  masteredOutGain.connect(outputSplitter);
  outputSplitter.connect(outputAnalyserL, 0);
  outputSplitter.connect(outputAnalyserR, 1);

  visualAnalyser.connect(audioContext.destination);

  // Set initial bypass volumes smoothly
  if (isBypassed) {
    masteredOutGain.gain.setValueAtTime(0.0, audioContext.currentTime);
    bypassGain.gain.setValueAtTime(1.0, audioContext.currentTime);
  } else {
    masteredOutGain.gain.setValueAtTime(1.0, audioContext.currentTime);
    bypassGain.gain.setValueAtTime(0.0, audioContext.currentTime);
  }

  // Run buffer
  sourceNode.start(0, pausedAt);
  startTime = audioContext.currentTime;
  isPlaying = true;
  
  updatePlayButtonUI(true);
  document.getElementById('status-text').innerText = isBypassed ? 'BYPASSED PLAYBACK' : 'MASTERING PLAYBACK';
  document.getElementById('status-indicator').className = 'status-indicator processing';

  // Start Realtime Canvas Render Loop
  startRenderLoop();
}

function pausePlayback() {
  if (!isPlaying) return;
  pausedAt += audioContext.currentTime - startTime;
  if (pausedAt >= audioBuffer.duration) {
    pausedAt = 0;
  }
  sourceNode.stop();
  isPlaying = false;
  updatePlayButtonUI(false);
  document.getElementById('status-text').innerText = 'PLAYBACK PAUSED';
  document.getElementById('status-indicator').className = 'status-indicator online';
  
  cancelAnimationFrame(animFrameId);
  resetLevelMeters();
}

function stopPlayback() {
  if (isPlaying) {
    sourceNode.stop();
  }
  pausedAt = 0;
  isPlaying = false;
  updatePlayButtonUI(false);
  document.getElementById('status-text').innerText = 'SYSTEM READY';
  document.getElementById('status-indicator').className = 'status-indicator online';
  
  cancelAnimationFrame(animFrameId);
  resetLevelMeters();
}

// ==========================================================================
// WAVEFORM RENDERING & SEEKING LOGIC
// ==========================================================================
function drawWaveformView() {
  const waveformCanvas = document.getElementById('waveform-canvas');
  if (!waveformCanvas || !originalPeaks || !audioBuffer) return;
  
  resizeCanvas(waveformCanvas);
  
  const waveCtx = waveformCanvas.getContext('2d');
  // HighDPI resize check
  const rect = waveformCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const wWidth = rect.width;
  const wHeight = rect.height;
  
  waveCtx.clearRect(0, 0, wWidth, wHeight);

  // Draw original waveform (Dry) in gray
  waveCtx.fillStyle = 'rgba(71, 85, 105, 0.35)';
  for (let i = 0; i < PEAK_POINTS; i++) {
    const x = (wWidth / PEAK_POINTS) * i;
    const maxVal = originalPeaks.max[i] * (wHeight * 0.45);
    const minVal = originalPeaks.min[i] * (wHeight * 0.45);
    waveCtx.fillRect(x, wHeight / 2 - maxVal, 1.2, maxVal - minVal);
  }

  // Draw active processed (wet) approximation in Cyan
  const proPeaks = getProcessedPeaks();
  waveCtx.fillStyle = 'rgba(0, 242, 254, 0.75)';
  const useShadows = window.innerWidth > 768;
  if (useShadows) {
    waveCtx.shadowBlur = 2;
    waveCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
  }
  for (let i = 0; i < PEAK_POINTS; i++) {
    const x = (wWidth / PEAK_POINTS) * i;
    const maxVal = proPeaks.max[i] * (wHeight * 0.45);
    const minVal = proPeaks.min[i] * (wHeight * 0.45);
    waveCtx.fillRect(x, wHeight / 2 - maxVal, 1.2, maxVal - minVal);
  }
  if (useShadows) {
    waveCtx.shadowBlur = 0;
  }

  // Draw playback cursor position
  const currentOffset = isPlaying ? (pausedAt + (audioContext.currentTime - startTime)) : pausedAt;
  const progress = currentOffset / audioBuffer.duration;
  if (progress <= 1.0) {
    const cursorX = progress * wWidth;
    waveCtx.strokeStyle = '#9d4edd';
    waveCtx.lineWidth = 1.5;
    if (useShadows) {
      waveCtx.shadowBlur = 8;
      waveCtx.shadowColor = '#9d4edd';
    }
    waveCtx.beginPath();
    waveCtx.moveTo(cursorX, 0);
    waveCtx.lineTo(cursorX, wHeight);
    waveCtx.stroke();
    if (useShadows) {
      waveCtx.shadowBlur = 0;
    }
  }
}

function seekTo(seconds) {
  if (!audioBuffer) return;
  
  // Clamp seek time to buffer boundaries
  seconds = Math.max(0, Math.min(audioBuffer.duration, seconds));
  
  logToUI(`Seeking playback position to ${seconds.toFixed(2)}s`, 'info');
  
  if (isPlaying) {
    // 1. Temporarily flag seeking to prevent stopPlayback triggering in sourceNode.onended
    isSeeking = true;
    try {
      sourceNode.onended = null; // Clear handler on old node before stopping to resolve race condition
      sourceNode.stop();
    } catch (e) {
      // already stopped or not started
    }
    
    pausedAt = seconds;
    
    // 2. Re-create source and trigger playback from new position
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = isLooping;
    
    sourceNode.onended = () => {
      if (isPlaying && !isLooping && !isSeeking) {
        const elapsed = audioContext.currentTime - startTime;
        if (elapsed + pausedAt >= audioBuffer.duration) {
          stopPlayback();
        }
      }
    };
    
    // Reconnect to entry points of live context
    sourceNode.connect(activeNodes.inputGain);
    sourceNode.connect(activeNodes.bypassGain);
    
    sourceNode.start(0, seconds);
    startTime = audioContext.currentTime;
    isSeeking = false;
  } else {
    // If paused, just update static position and redraw playhead
    pausedAt = seconds;
    drawWaveformView();
  }
}

// ==========================================================================
// REAL-TIME VISUALIZATIONS LOOP
// ==========================================================================
function startRenderLoop() {
  const spectrumCanvas = document.getElementById('spectrum-canvas');
  const specCtx = spectrumCanvas.getContext('2d');
  
  const waveformCanvas = document.getElementById('waveform-canvas');
  
  // HighDPI canvas resize
  resizeCanvas(spectrumCanvas);
  resizeCanvas(waveformCanvas);

  let lastFrameTime = 0;
  const isMobile = window.innerWidth <= 768;
  const targetFps = isMobile ? 30 : 60;
  const fpsInterval = 1000 / targetFps;

  function draw(currentTime) {
    if (!isPlaying) return;
    animFrameId = requestAnimationFrame(draw);

    const timestamp = currentTime || performance.now();
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < fpsInterval) {
      return; // Throttle frame rate
    }
    lastFrameTime = timestamp - (elapsed % fpsInterval);

    try {
      const currentW = spectrumCanvas.width;
      const currentH = spectrumCanvas.height;

      // ------------------------------------------
      // 1. Draw Spectrum Visualizer
      // ------------------------------------------
      if (activeTab === 'spectrum') {
        resizeCanvas(spectrumCanvas);
        const bufferLength = activeNodes.visualAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        activeNodes.visualAnalyser.getByteFrequencyData(dataArray);

        specCtx.clearRect(0, 0, currentW, currentH);

        // Grid background
        specCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        specCtx.lineWidth = 1;
        const verticalLines = 8;
        for (let i = 1; i < verticalLines; i++) {
          const x = (currentW / verticalLines) * i;
          specCtx.beginPath();
          specCtx.moveTo(x, 0);
          specCtx.lineTo(x, currentH);
          specCtx.stroke();
        }

        // Spectrum curve gradient
        const gradient = specCtx.createLinearGradient(0, currentH, 0, 0);
        gradient.addColorStop(0, 'rgba(157, 78, 221, 0.0)');
        gradient.addColorStop(0.5, 'rgba(157, 78, 221, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 242, 254, 0.8)');

        specCtx.beginPath();
        specCtx.moveTo(0, currentH);

        const sliceWidth = currentW / (bufferLength * 0.7); // Clip top frequencies (>15kHz) for nicer scale
        let x = 0;

        for (let i = 0; i < bufferLength * 0.7; i++) {
          // Logarithmic scaling for human ear frequency resolution
          const percentIdx = i / (bufferLength * 0.7);
          const logIdx = Math.floor(Math.pow(percentIdx, 1.8) * (bufferLength * 0.7));
          const v = dataArray[logIdx] / 255.0;
          const y = currentH - v * (currentH * 0.82);

          if (i === 0) {
            specCtx.moveTo(x, y);
          } else {
            specCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }
        specCtx.lineTo(currentW, currentH);
        specCtx.fillStyle = gradient;
        specCtx.fill();

        // Outer glowing line
        specCtx.lineWidth = 2.5;
        specCtx.strokeStyle = '#00f2fe';
        const useShadows = window.innerWidth > 768;
        if (useShadows) {
          specCtx.shadowBlur = 6;
          specCtx.shadowColor = 'rgba(0, 242, 254, 0.6)';
        }
        
        specCtx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength * 0.7; i++) {
          const percentIdx = i / (bufferLength * 0.7);
          const logIdx = Math.floor(Math.pow(percentIdx, 1.8) * (bufferLength * 0.7));
          const v = dataArray[logIdx] / 255.0;
          const y = currentH - v * (currentH * 0.82);

          if (i === 0) {
            specCtx.moveTo(x, y);
          } else {
            specCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        specCtx.stroke();
        if (useShadows) {
          specCtx.shadowBlur = 0; // Reset shadow
        }
      }

      // ------------------------------------------
      // 2. Draw Waveform Visualizer
      // ------------------------------------------
      if (activeTab === 'waveform' && originalPeaks) {
        drawWaveformView();
      }

      // ------------------------------------------
      // 3. Peak/RMS level monitoring & VU meter update
      // ------------------------------------------
      updateLevelMeters();
    } catch (err) {
      console.error('Visualizer rendering loop error caught:', err);
    }
  }

  draw();
}

function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);
  
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return true; // Canvas was resized
  }
  return false; // No resize needed
}

// Extract max and min peak envelopes from loaded buffer
function extractPeaks(buffer, numPoints) {
  const chL = buffer.getChannelData(0);
  const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;
  const totalLength = buffer.length;
  const blockSize = Math.floor(totalLength / numPoints);
  
  const maxPeaks = new Float32Array(numPoints);
  const minPeaks = new Float32Array(numPoints);
  
  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalLength);
    
    let max = -1.0;
    let min = 1.0;
    
    for (let j = start; j < end; j++) {
      const val = (chL[j] + chR[j]) * 0.5;
      if (val > max) max = val;
      if (val < min) min = val;
    }
    
    maxPeaks[i] = max;
    minPeaks[i] = min;
  }
  
  return { max: maxPeaks, min: minPeaks };
}

// Approximate processed waveform shape in JS based on sliders
function calculateProcessedPeaks() {
  const proMax = new Float32Array(PEAK_POINTS);
  const proMin = new Float32Array(PEAK_POINTS);
  
  const inputG = Math.pow(10, params.inputGainDb / 20);
  const limitG = Math.pow(10, params.limiterBoost / 20);
  const ceilingG = Math.pow(10, params.ceiling / 20);
  
  const compThreshLinear = Math.pow(10, params.compThreshold / 20);
  const ratio = params.compEnabled ? params.compRatio : 1.0;

  // 視覚的な「のり波形（フラットな潰れ）」を防ぎ、音楽的なピークの強弱を維持するソフトリミッターシミュレータ
  const softLimit = (x) => {
    const absX = Math.abs(x);
    if (absX < 0.15) return x;
    return Math.sign(x) * (absX / Math.pow(1.0 + Math.pow(absX, 3.0), 1.0 / 3.0));
  };

  for (let i = 0; i < PEAK_POINTS; i++) {
    let max = originalPeaks.max[i] * inputG;
    let min = originalPeaks.min[i] * inputG;

    // Fast compressor math simulation
    if (params.compEnabled) {
      // Squash positive
      const absMax = Math.abs(max);
      if (absMax > compThreshLinear) {
        max = Math.sign(max) * (compThreshLinear + (absMax - compThreshLinear) / ratio);
      }
      // Squash negative
      const absMin = Math.abs(min);
      if (absMin > compThreshLinear) {
        min = Math.sign(min) * (compThreshLinear + (absMin - compThreshLinear) / ratio);
      }
    }

    // Saturation simulation (tape soft clip)
    if (params.satEnabled) {
      const blend = params.satMix / 100;
      const k = 0.5 + (params.satDrive / 100) * 5.5;
      
      const satMax = Math.tanh(k * max) / Math.tanh(k);
      const satMin = Math.tanh(k * min) / Math.tanh(k);

      max = max * (1.0 - blend) + satMax * blend;
      min = min * (1.0 - blend) + satMin * blend;
    }

    // Boost into Limiter
    max *= limitG;
    min *= limitG;

    // ソフトリミッターにより、波形の頂点が完全に平ら（音割れ風）になるのを防ぐ
    max = softLimit(max);
    min = softLimit(min);

    // Output Ceiling
    max *= ceilingG;
    min *= ceilingG;

    proMax[i] = max;
    proMin[i] = min;
  }

  return { max: proMax, min: proMin };
}

// Get the maximum amplitude peak in dB from analyser time domain array
function getPeakDb(timeData) {
  let peak = 0.0;
  for (let i = 0; i < timeData.length; i++) {
    const val = Math.abs(timeData[i]);
    if (val > peak) peak = val;
  }
  if (peak === 0.0) return -60;
  const db = 20 * Math.log10(peak);
  return db;
}

// Convert decibels to a visual meter percentage (range -60dB to 0dB)
function dbToPercent(db) {
  if (db < -60) return 0;
  if (db > 0) return 100;
  return ((db + 60) / 60) * 100;
}

function updateLevelMeters() {
  // Input Level Analyser Arrays
  const timeInL = new Float32Array(activeNodes.inputAnalyserL.fftSize);
  const timeInR = new Float32Array(activeNodes.inputAnalyserR.fftSize);
  activeNodes.inputAnalyserL.getFloatTimeDomainData(timeInL);
  activeNodes.inputAnalyserR.getFloatTimeDomainData(timeInR);

  // Output Level Analyser Arrays
  const timeOutL = new Float32Array(activeNodes.outputAnalyserL.fftSize);
  const timeOutR = new Float32Array(activeNodes.outputAnalyserR.fftSize);
  activeNodes.outputAnalyserL.getFloatTimeDomainData(timeOutL);
  activeNodes.outputAnalyserR.getFloatTimeDomainData(timeOutR);

  // Get current DB peaks
  const dbInL = getPeakDb(timeInL);
  const dbInR = getPeakDb(timeInR);
  const dbOutL = getPeakDb(timeOutL);
  const dbOutR = getPeakDb(timeOutR);

  // Meter envelope physics: instant attack, exponential slow release decay
  const DECAY_DB = 1.6; // dB per frame
  meterInPeakL = Math.max(dbInL, meterInPeakL - DECAY_DB);
  meterInPeakR = Math.max(dbInR, meterInPeakR - DECAY_DB);
  meterOutPeakL = Math.max(dbOutL, meterOutPeakL - DECAY_DB);
  meterOutPeakR = Math.max(dbOutR, meterOutPeakR - DECAY_DB);

  // Update DOM fills using GPU-accelerated transform: scaleY
  document.getElementById('meter-in-l').style.transform = `scaleY(${dbToPercent(meterInPeakL) / 100})`;
  document.getElementById('meter-in-r').style.transform = `scaleY(${dbToPercent(meterInPeakR) / 100})`;
  document.getElementById('meter-out-l').style.transform = `scaleY(${dbToPercent(meterOutPeakL) / 100})`;
  document.getElementById('meter-out-r').style.transform = `scaleY(${dbToPercent(meterOutPeakR) / 100})`;

  // ------------------------------------------
  // 4. Stereo Phase Correlation Index
  // ------------------------------------------
  let dotProduct = 0;
  let sumL2 = 0;
  let sumR2 = 0;
  for (let i = 0; i < timeOutL.length; i++) {
    const l = timeOutL[i];
    const r = timeOutR[i];
    dotProduct += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
  }
  
  if (sumL2 > 0 && sumR2 > 0) {
    const correlation = dotProduct / Math.sqrt(sumL2 * sumR2);
    // Smooth the visual pointer changes slightly
    correlationValue = correlationValue * 0.8 + correlation * 0.2;
  } else {
    correlationValue = correlationValue * 0.8 + 1.0 * 0.2; // Return to center mono
  }
  
  // Pointer position from -1 (0%) to +1 (100%)
  const pointerPercent = ((correlationValue + 1) / 2) * 100;
  document.getElementById('corr-pointer').style.left = `${pointerPercent}%`;

  // ------------------------------------------
  // 5. Gain Reduction (GR) Meter
  // ------------------------------------------
  let compGr = 0;
  let limiterGr = 0;

  if (activeNodes.compressor) {
    // compressor.reduction is a negative float value representing dB
    compGr = Math.abs(activeNodes.compressor.reduction);
  }
  if (activeNodes.limiter) {
    limiterGr = Math.abs(activeNodes.limiter.reduction);
  }

  // Combined gain reduction display
  const combinedGr = compGr + limiterGr;
  grPeak = Math.max(combinedGr, grPeak - 0.4); // Decay GR meter slower

  // GR Meter height maps from 0dB to 15dB
  const grPercent = Math.min(100, (grPeak / 15) * 100);
  document.getElementById('meter-gr').style.transform = `scaleY(${grPercent / 100})`;

  // Limiter Active Light Indicator
  const limitLight = document.getElementById('limiter-light');
  if (limiterGr > 0.1) {
    limitLight.className = 'limiter-light active';
  } else {
    limitLight.className = 'limiter-light';
  }

  // Clip Detector indicator (Out peak > Ceiling warning)
  const isClipping = dbOutL > params.ceiling + 0.1 || dbOutR > params.ceiling + 0.1;
  const warningText = document.getElementById('limiter-warning');
  if (isClipping) {
    warningText.className = 'limiter-warning';
  } else {
    warningText.className = 'limiter-warning hidden';
  }
}

function resetLevelMeters() {
  document.getElementById('meter-in-l').style.transform = 'scaleY(0)';
  document.getElementById('meter-in-r').style.transform = 'scaleY(0)';
  document.getElementById('meter-out-l').style.transform = 'scaleY(0)';
  document.getElementById('meter-out-r').style.transform = 'scaleY(0)';
  document.getElementById('meter-gr').style.transform = 'scaleY(0)';
  document.getElementById('corr-pointer').style.left = '50%';
  document.getElementById('limiter-light').className = 'limiter-light';
  document.getElementById('limiter-warning').className = 'limiter-warning hidden';
  
  meterInPeakL = -60;
  meterInPeakR = -60;
  meterOutPeakL = -60;
  meterOutPeakR = -60;
  grPeak = 0;
  correlationValue = 1.0;
}

// ==========================================================================
// REAL-TIME NODE UPDATE ROUTINES
// ==========================================================================
function updateInputGainNode() {
  invalidatePeakCache();
  if (activeNodes.inputGain) {
    const gainVal = Math.pow(10, params.inputGainDb / 20);
    activeNodes.inputGain.gain.setTargetAtTime(gainVal, audioContext.currentTime, 0.01);
  }
}

function updateCeilingNode() {
  invalidatePeakCache();
  if (activeNodes.ceilingGain) {
    const gainVal = Math.pow(10, params.ceiling / 20);
    activeNodes.ceilingGain.gain.setTargetAtTime(gainVal, audioContext.currentTime, 0.01);
  }
}

function updateSaturatorNode() {
  invalidatePeakCache();
  if (activeNodes.waveShaper) {
    activeNodes.waveShaper.curve = generateSaturatorCurve(params.satType, params.satDrive);
    
    if (params.satEnabled) {
      const blend = params.satMix / 100;
      activeNodes.satDryGain.gain.setTargetAtTime(1.0 - 0.3 * blend, audioContext.currentTime, 0.01);
      activeNodes.satWetGain.gain.setTargetAtTime(blend, audioContext.currentTime, 0.01);
    } else {
      activeNodes.satDryGain.gain.setTargetAtTime(1.0, audioContext.currentTime, 0.01);
      activeNodes.satWetGain.gain.setTargetAtTime(0.0, audioContext.currentTime, 0.01);
    }
  }
}

function updateEqNodes() {
  invalidatePeakCache();
  if (activeNodes.eqLow) {
    activeNodes.eqLow.frequency.setTargetAtTime(params.eqLowFreq, audioContext.currentTime, 0.01);
    activeNodes.eqLow.gain.setTargetAtTime(params.eqLowGain, audioContext.currentTime, 0.01);
  }
  if (activeNodes.eqMid) {
    activeNodes.eqMid.frequency.setTargetAtTime(params.eqMidFreq, audioContext.currentTime, 0.01);
    activeNodes.eqMid.gain.setTargetAtTime(params.eqMidGain, audioContext.currentTime, 0.01);
  }
  if (activeNodes.eqHigh) {
    activeNodes.eqHigh.frequency.setTargetAtTime(params.eqHighFreq, audioContext.currentTime, 0.01);
    activeNodes.eqHigh.gain.setTargetAtTime(params.eqHighGain, audioContext.currentTime, 0.01);
  }
}

function updateCorrectiveEqNodes() {
  invalidatePeakCache();
  for (let i = 0; i < 8; i++) {
    const nodeName = `eqCorrective${i + 1}`;
    if (activeNodes[nodeName]) {
      const n = params.correctiveNotches[i];
      activeNodes[nodeName].frequency.setTargetAtTime(n.freq, audioContext.currentTime, 0.01);
      activeNodes[nodeName].gain.setTargetAtTime(n.enabled ? n.gain : 0.0, audioContext.currentTime, 0.01);
    }
  }
}

function updateCompressorNode() {
  invalidatePeakCache();
  if (activeNodes.compressor) {
    if (params.compEnabled) {
      activeNodes.compressor.threshold.setTargetAtTime(params.compThreshold, audioContext.currentTime, 0.01);
      activeNodes.compressor.ratio.setTargetAtTime(params.compRatio, audioContext.currentTime, 0.01);
      activeNodes.compressor.attack.setTargetAtTime(params.compAttack, audioContext.currentTime, 0.01);
      activeNodes.compressor.release.setTargetAtTime(params.compRelease, audioContext.currentTime, 0.01);
    } else {
      activeNodes.compressor.threshold.setTargetAtTime(0, audioContext.currentTime, 0.01);
      activeNodes.compressor.ratio.setTargetAtTime(1.0, audioContext.currentTime, 0.01); // no-compression
    }
  }
}

function updateStereoWidthNode() {
  if (activeNodes.midGain && activeNodes.sideGain) {
    const w = params.stereoWidth;
    activeNodes.midGain.gain.setTargetAtTime(1.0, audioContext.currentTime, 0.01);
    activeNodes.sideGain.gain.setTargetAtTime(w, audioContext.currentTime, 0.01);
    
    // Animate width indicator beams in HTML
    // left: rotate angle based on width (0 width = 0 deg, 2 width = -60 deg)
    const angleL = -45 * w;
    const angleR = 45 * w;
    document.getElementById('width-beam-l').style.transform = `rotate(${angleL}deg)`;
    document.getElementById('width-beam-r').style.transform = `rotate(${angleR}deg)`;
  }
}

function updateLimiterGainNode() {
  invalidatePeakCache();
  if (activeNodes.limiterGain) {
    const gainVal = Math.pow(10, params.limiterBoost / 20);
    activeNodes.limiterGain.gain.setTargetAtTime(gainVal, audioContext.currentTime, 0.01);
  }
}

function updateBypassRouting() {
  if (activeNodes.masteredOutGain && activeNodes.bypassGain) {
    const time = audioContext.currentTime;
    // Crossfade smoothly over 50ms to prevent pops/clicks
    if (isBypassed) {
      activeNodes.masteredOutGain.gain.setValueAtTime(activeNodes.masteredOutGain.gain.value, time);
      activeNodes.masteredOutGain.gain.linearRampToValueAtTime(0.0, time + 0.05);
      
      activeNodes.bypassGain.gain.setValueAtTime(activeNodes.bypassGain.gain.value, time);
      activeNodes.bypassGain.gain.linearRampToValueAtTime(1.0, time + 0.05);
      document.getElementById('status-text').innerText = 'BYPASSED PLAYBACK';
    } else {
      activeNodes.masteredOutGain.gain.setValueAtTime(activeNodes.masteredOutGain.gain.value, time);
      activeNodes.masteredOutGain.gain.linearRampToValueAtTime(1.0, time + 0.05);
      
      activeNodes.bypassGain.gain.setValueAtTime(activeNodes.bypassGain.gain.value, time);
      activeNodes.bypassGain.gain.linearRampToValueAtTime(0.0, time + 0.05);
      document.getElementById('status-text').innerText = 'MASTERING PLAYBACK';
    }
  }
}

// ==========================================================================
// AI SPECTRAL ANALYSIS & AUTO-EQ ALGORITHMS
// ==========================================================================
// Cooley-Tukey Radix-2 FFT (Fast Fourier Transform)
function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;
  
  const reEven = new Float32Array(n / 2);
  const imEven = new Float32Array(n / 2);
  const reOdd = new Float32Array(n / 2);
  const imOdd = new Float32Array(n / 2);
  
  for (let i = 0; i < n / 2; i++) {
    reEven[i] = re[2 * i];
    imEven[i] = im[2 * i];
    reOdd[i] = re[2 * i + 1];
    imOdd[i] = im[2 * i + 1];
  }
  
  fft(reEven, imEven);
  fft(reOdd, imOdd);
  
  for (let k = 0; k < n / 2; k++) {
    const t = (k / n) * 2 * Math.PI;
    const wr = Math.cos(t);
    const wi = -Math.sin(t);
    
    const reT = reOdd[k] * wr - imOdd[k] * wi;
    const imT = reOdd[k] * wi + imOdd[k] * wr;
    
    re[k] = reEven[k] + reT;
    im[k] = imEven[k] + imT;
    re[k + n / 2] = reEven[k] - reT;
    im[k + n / 2] = imEven[k] - imT;
  }
}

// 分析関数：オーディオバッファをマルチスライス分析し、ダイナミクス、ステレオ音像、周波数バランス、耳障りな周波数（シャリシャリ音）を検出する
function analyzeAudioResonances(buffer) {
  const fftSize = 2048;
  const numSlices = 32; // サンプリング精度を高めるため、32箇所を走査
  const sampleRate = buffer.sampleRate;
  const chL = buffer.getChannelData(0);
  const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;
  
  const avgSpectrum = new Float32Array(fftSize / 2);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  
  // 1. サンプリングポイントの算出（前後10%はブレや静音部回避のため避ける）
  const slicePoints = [];
  const startOffset = Math.floor(buffer.length * 0.1);
  const endOffset = Math.floor(buffer.length * 0.9);
  const range = endOffset - startOffset;
  for (let i = 0; i < numSlices; i++) {
    slicePoints.push(startOffset + Math.floor(range * (i / (numSlices - 1))));
  }
  
  let totalEnergyL2 = 0;
  let totalEnergyR2 = 0;
  let totalDotProduct = 0;
  let maxAbsSample = 0.0;
  let sumRMS2 = 0.0;
  let sampleCount = 0;

  for (const startIdx of slicePoints) {
    let sliceMax = 0.0;
    let sliceSumSq = 0.0;
    
    let sliceDotProduct = 0;
    let sliceSumL2 = 0;
    let sliceSumR2 = 0;

    // 左右チャネルの平均を窓に格納しつつ、各種統計データを集計
    for (let j = 0; j < fftSize; j++) {
      const idx = startIdx + j;
      if (idx >= buffer.length) break;

      const l = chL[idx];
      const r = chR[idx];
      const mid = (l + r) * 0.5;

      // FFT用データ
      re[j] = mid;
      im[j] = 0;

      // クレストファクター集計用
      const absMid = Math.abs(mid);
      if (absMid > sliceMax) sliceMax = absMid;
      sliceSumSq += mid * mid;

      // ステレオ相関用
      sliceDotProduct += l * r;
      sliceSumL2 += l * l;
      sliceSumR2 += r * r;
    }
    
    // 最大ピークの更新
    if (sliceMax > maxAbsSample) maxAbsSample = sliceMax;
    
    // RMS集計
    const sliceRMS = Math.sqrt(sliceSumSq / fftSize);
    sumRMS2 += sliceRMS * sliceRMS;

    // ステレオ相関の加算
    totalDotProduct += sliceDotProduct;
    totalEnergyL2 += sliceSumL2;
    totalEnergyR2 += sliceSumR2;

    // ハニング窓（Hanning window）を適用
    for (let j = 0; j < fftSize; j++) {
      const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * j) / (fftSize - 1)));
      re[j] *= windowVal;
    }
    
    // FFT実行
    fft(re, im);
    
    // スペクトラム強度の算出と累積
    for (let j = 0; j < fftSize / 2; j++) {
      const mag = Math.sqrt(re[j] * re[j] + im[j] * im[j]);
      avgSpectrum[j] += mag / numSlices;
    }
  }

  // クレストファクター (dB)
  const avgRMS = Math.sqrt(sumRMS2 / numSlices);
  const crestRatio = maxAbsSample / (avgRMS + 1e-6);
  const crestFactorDb = Math.max(0.0, 20 * Math.log10(crestRatio));

  // ステレオ相関値 (-1.0 〜 +1.0)
  let avgCorrelation = 1.0;
  if (totalEnergyL2 > 0 && totalEnergyR2 > 0) {
    avgCorrelation = totalDotProduct / Math.sqrt(totalEnergyL2 * totalEnergyR2);
    avgCorrelation = Math.max(-1.0, Math.min(1.0, avgCorrelation));
  }

  // 2. 周波数帯域別エネルギーの集計
  // 低域: 20Hz - 250Hz, 中域: 250Hz - 4kHz, 高域: 4kHz - 20kHz
  const binLowStart = Math.floor((20 * fftSize) / sampleRate);
  const binLowEnd = Math.floor((250 * fftSize) / sampleRate);
  const binMidStart = binLowEnd + 1;
  const binMidEnd = Math.floor((4000 * fftSize) / sampleRate);
  const binHighStart = binMidEnd + 1;
  const binHighEnd = Math.min(fftSize / 2 - 1, Math.floor((20000 * fftSize) / sampleRate));

  let lowSum = 0;
  for (let j = binLowStart; j <= binLowEnd; j++) lowSum += avgSpectrum[j];
  const lowEnergy = lowSum / (binLowEnd - binLowStart + 1);

  let midSum = 0;
  for (let j = binMidStart; j <= binMidEnd; j++) midSum += avgSpectrum[j];
  const midEnergy = midSum / (binMidEnd - binMidStart + 1);

  let highSum = 0;
  for (let j = binHighStart; j <= binHighEnd; j++) highSum += avgSpectrum[j];
  const highEnergy = highSum / (binHighEnd - binHighStart + 1);

  // 実際のエネルギー比率
  const actualLowMidRatio = lowEnergy / (midEnergy + 1e-6);
  const actualHighMidRatio = highEnergy / (midEnergy + 1e-6);

  // 3. 耳障りな高音域（シャリシャリした sibilance 帯域：5kHz 〜 12kHz）のマルチピーク走査
  const sibilanceMinBin = Math.floor((5000 * fftSize) / sampleRate);
  const sibilanceMaxBin = Math.floor((12000 * fftSize) / sampleRate);
  
  // この帯域全体の平均強度（ベースライン）を計算
  let sumRegion = 0;
  for (let j = sibilanceMinBin; j <= sibilanceMaxBin; j++) {
    sumRegion += avgSpectrum[j];
  }
  const sibilanceBaseline = sumRegion / (sibilanceMaxBin - sibilanceMinBin + 1);
  
  // ローカルピーク（極大値かつベースラインの1.18倍以上。ただし9kHz〜10kHzのSuno頻出帯域は敏感に検知するため1.08倍以上）をすべて検出
  const rawPeaks = [];
  for (let j = sibilanceMinBin + 1; j < sibilanceMaxBin; j++) {
    const val = avgSpectrum[j];
    const peakFreq = Math.round((j * sampleRate) / fftSize);
    
    // Suno AIの音源で特に耳に刺さりやすい 9kHz〜10kHz 帯域（マージンを取り8800Hz〜10200Hz）の判定
    const isSunoRange = (peakFreq >= 8800 && peakFreq <= 10200);
    const thresholdMultiplier = isSunoRange ? 1.08 : 1.18;
    
    if (val > sibilanceBaseline * thresholdMultiplier && val > avgSpectrum[j - 1] && val > avgSpectrum[j + 1]) {
      const ratio = val / sibilanceBaseline;
      // 超過度合いに基づき減衰幅を設定（Suno帯域は耳を保護するため強くカット: -1.8dB 〜 -6.0dB、通常は -1.2dB 〜 -5.0dB）
      let cutDb;
      if (isSunoRange) {
        cutDb = -Math.min(6.0, Math.max(1.8, (ratio - 1.08) * 8.0 + 1.8));
      } else {
        cutDb = -Math.min(5.0, Math.max(1.2, (ratio - 1.18) * 6.0 + 1.2));
      }
      
      rawPeaks.push({
        freq: peakFreq,
        cut: cutDb,
        val: val,
        isSunoRange: isSunoRange,
        // Suno帯域のピークを優先的にマスタリングEQ補正対象へ選ぶため、スコアに2.0倍の下駄を履かせる
        score: ratio * (isSunoRange ? 2.0 : 1.0)
      });
    }
  }

  // 優先度スコアの高い順にソート
  rawPeaks.sort((a, b) => b.score - a.score);

  // 互いに400Hz以上離れた上位最大6個のピークを抽出（抜け感確保のため6個に制限）
  const filteredPeaks = [];
  for (const peak of rawPeaks) {
    if (filteredPeaks.length >= 6) break;
    const tooClose = filteredPeaks.some(p => Math.abs(p.freq - peak.freq) < 400);
    if (!tooClose) {
      filteredPeaks.push({ freq: peak.freq, cut: peak.cut });
    }
  }

  // 4. 最適マスタリングパラメーターの動的算出（ターゲット比率への収束）
  // 選択されているジャンルプリセットの取得
  const genreSelect = document.getElementById('preset-select');
  const genreKey = genreSelect ? genreSelect.value : 'pops';
  const basePreset = GENRE_PRESETS[genreKey] || GENRE_PRESETS.pops;

  // ジャンル別理想ターゲット比率
  const genreTargets = {
    auto: { low: 2.8, high: 0.15 }, // AI AUTO: 標準スタジオ・リファレンス目標値
    pops: { low: 2.7, high: 0.16 },
    rnb: { low: 3.4, high: 0.17 },   // R&B: 豊かな低域と滑らかな高域
    rock: { low: 3.0, high: 0.14 }, // 適度な低音に緩和
    metal: { low: 3.1, high: 0.15 }, // メタル: 引き締まった重低音とエッジの効いた高域
    edm: { low: 3.3, high: 0.19 },  // 適度な低音に緩和
    hiphop: { low: 3.5, high: 0.16 }, // 適度な低音に緩和
    lofi: { low: 3.2, high: 0.11 },
    hardcore: { low: 3.3, high: 0.18 }, // 適度な低音に緩和
    ambient: { low: 3.2, high: 0.22 },  // 適度な低音に緩和
    podcast: { low: 1.8, high: 0.11 },  // ポッドキャスト: 低域の吹かれ・空調カット、声重視
    classic: { low: 2.2, high: 0.11 },
    jazz: { low: 2.9, high: 0.13 },
    acoustic: { low: 2.3, high: 0.12 }, // アコースティック: 生楽器の自然な低域・澄んだ高域
    custom: { low: 2.8, high: 0.15 }
  };
  const target = genreTargets[genreKey] || genreTargets.auto;

  // 各帯域のエネルギー差分（dB換算）
  const lowDiffDb = 20 * Math.log10(actualLowMidRatio / target.low);
  const highDiffDb = 20 * Math.log10(actualHighMidRatio / target.high);

  // 3バンドEQ補正量の算出 (元のプリセット値に対して緩やかに補正)
  // 低域: Bassが多すぎる場合は下げ、足りない場合は持ち上げる
  let eqLowAdjustment = 0;
  if (lowDiffDb > 0.5) {
    eqLowAdjustment = -Math.min(3.5, lowDiffDb * 0.75); // マイルドに下げる
  } else if (lowDiffDb < -0.5) {
    eqLowAdjustment = Math.min(3.0, -lowDiffDb * 0.75); // 不足分を足す
  }
  // 低域EQブーストを最大 +3.5 dB、カットを最大 -5.0 dB に制限して割れを防止
  const eqLowGain = Math.max(-5.0, Math.min(3.5, Math.round((basePreset.eqLowGain + eqLowAdjustment) * 2) / 2));

  // 高域: Highが派手すぎる場合は下げ、こもっている場合は持ち上げる
  let eqHighAdjustment = 0;
  if (highDiffDb > 0.5) {
    eqHighAdjustment = -Math.min(3.0, highDiffDb * 0.8);
  } else if (highDiffDb < -0.5) {
    eqHighAdjustment = Math.min(3.0, -highDiffDb * 0.8);
  }
  const eqHighGain = Math.max(-5.0, Math.min(4.0, Math.round((basePreset.eqHighGain + eqHighAdjustment) * 2) / 2));

  // 中域はジャンルの特性を維持
  const eqMidGain = basePreset.eqMidGain;

  // 現在選択されているラウドネス・ターゲットの取得と基準ブースト値の設定
  // バグ修正: AIオートコレクトの重複加算を防ぐため、スライダー変更で 'custom' になる前の基準ターゲット (baseLoudnessTarget) を参照
  const loudnessKey = typeof baseLoudnessTarget !== 'undefined' ? baseLoudnessTarget : (document.getElementById('loudness-select')?.value || 'genre');
  let baseBoost = 4.0;
  let baseLoudnessDesc = "STREAMING (-14 LUFS)";
  
  if (loudnessKey === 'genre') {
    baseBoost = basePreset.limiterBoost;
    const genreName = genreKey.toUpperCase();
    baseLoudnessDesc = `GENRE DEFAULT (${genreName}: +${baseBoost.toFixed(1)} dB)`;
  } else if (LOUDNESS_TARGETS[loudnessKey] && LOUDNESS_TARGETS[loudnessKey].boost !== null) {
    baseBoost = LOUDNESS_TARGETS[loudnessKey].boost;
    const targetNames = {
      streaming: "STREAMING (-14 LUFS)",
      club: "CLUB/MODERN (-9 LUFS)",
      loud: "LOUD (-7 LUFS)",
      pure: "PURE (-18 LUFS)"
    };
    baseLoudnessDesc = targetNames[loudnessKey] || `TARGET (+${baseBoost.toFixed(1)} dB)`;
  } else {
    baseBoost = params.limiterBoost;
    baseLoudnessDesc = `CUSTOM (+${baseBoost.toFixed(1)} dB)`;
  }

  // ダイナミクス補正 (クレストファクター分析)
  let compThreshold = basePreset.compThreshold;
  let compRatio = basePreset.compRatio;
  let limiterBoost = baseBoost;
  let crestDesc = "Normal (Balanced)";

  // ジャンル別理想ターゲット・クレストファクター（強弱の幅）
  const genreTargetCrest = {
    auto: 11.0, // AI AUTO: バランスの良い適度なダイナミクス幅
    pops: 12.5,
    rnb: 11.5,   // R&B: 滑らかで心地よいダイナミクス
    rock: 10.0,
    metal: 8.5,   // メタル: 音圧が高く手数が速いドラムに合わせた狭い幅
    edm: 8.0,
    hiphop: 9.0,
    lofi: 12.0,
    hardcore: 7.5,
    ambient: 13.5,
    podcast: 10.5, // ポッドキャスト: 会話が聞き取りやすい圧縮率
    classic: 15.0,
    jazz: 12.0,
    acoustic: 14.0, // アコースティック: 生楽器の強弱を最大限活かす
    custom: 11.0
  };
  const targetCrest = genreTargetCrest[genreKey] || genreTargetCrest.auto;

  const crestDiff = crestFactorDb - targetCrest;
  if (crestDiff > 1.5) {
    // 音源が非常にダイナミックな場合（強弱の幅が広い） -> コンプレッサーを少し深めに設定、音圧ブーストも多めに許容
    compThreshold = -18.0;
    compRatio = 2.0;
    crestDesc = "High (Highly Dynamic)";
    const bonus = Math.min(1.0, crestDiff * 0.25); // マイルドな加算に調整
    limiterBoost = baseBoost + bonus;
  } else if (crestDiff < -1.5) {
    // 音源が既に圧縮されている場合 -> 二重圧縮による歪みを防ぐため、圧縮を極めて浅くし、ブーストを適度に抑制
    compThreshold = -8.0; // 圧縮しすぎないように浅いしきい値
    compRatio = 1.25;    // 低い圧縮比率
    crestDesc = "Low (Highly Compressed)";
    const penalty = Math.min(2.5, -crestDiff * 0.40); // マイルドな減衰に調整
    limiterBoost = baseBoost - penalty;
  } else {
    // 標準的なダイナミクス -> 基準ブースト値に追従
    crestDesc = "Normal (Balanced)";
    limiterBoost = baseBoost;
  }

  // 0.0〜10.0dB の範囲に制限し（歪み防止のため最大値を10dBに抑制）、小数点第一位に丸める
  limiterBoost = Math.max(0.0, Math.min(10.0, Math.round(limiterBoost * 10) / 10));

  // ステレオ幅の補正 (相関値分析)
  let stereoWidth = basePreset.stereoWidth;
  let corrDesc = "Balanced";
  
  if (avgCorrelation > 0.8) {
    // 位相がほぼセンターに集まっている（モノラルに近い）-> ステレオ感を拡張
    stereoWidth = Math.min(2.0, basePreset.stereoWidth + 0.2);
    corrDesc = "Mono-leaning (Expanded)";
  } else if (avgCorrelation < 0.45) {
    // 左右に広がりすぎている、または逆位相成分が多い -> 位相干渉による打ち消しを防ぐため、Widthを狭める
    stereoWidth = Math.max(1.0, basePreset.stereoWidth - 0.15);
    corrDesc = "Wide/Phasey (Reduced)";
  } else {
    corrDesc = "Balanced Stereo";
  }

  // サチュレーター微調整 (高域の量に応じて歪みの強さを補正)
  let satDrive = basePreset.satDrive;
  let satMix = basePreset.satMix;
  if (highDiffDb > 1.5) {
    // 元々高域がかなり明るい（またはうるさい）曲の場合、サチュレーションを抑えて金属的なキツさを防ぐ
    satDrive = Math.max(1, basePreset.satDrive - 5);
    satMix = Math.max(0, basePreset.satMix - 8);
  } else if (highDiffDb < -1.5) {
    // 高域がこもっている曲の場合、サチュレーターのブレンド率とドライブを少し上げて倍音を付加する
    satDrive = Math.min(100, basePreset.satDrive + 5);
    satMix = Math.min(100, basePreset.satMix + 5);
  }

  // 入力音量の自動ゲインステージング（ピークを-6.0dBに合わせることで歪みを防ぎ、ヘッドルームを確保する）
  const originalPeakDb = 20 * Math.log10(maxAbsSample + 1e-6);
  const suggestedInputGainDb = Math.max(-12.0, Math.min(12.0, -6.0 - originalPeakDb));

  return {
    detected: filteredPeaks.length > 0,
    notches: filteredPeaks,
    crestFactor: crestFactorDb,
    crestDesc: crestDesc,
    correlation: avgCorrelation,
    correlationDesc: corrDesc,
    bassDiff: lowDiffDb,
    trebleDiff: highDiffDb,
    baseLoudnessDesc: baseLoudnessDesc,
    suggestedParams: {
      inputGainDb: Math.round(suggestedInputGainDb * 10) / 10,
      satEnabled: basePreset.satEnabled,
      satType: basePreset.satType,
      satDrive: satDrive,
      satMix: satMix,
      eqLowGain: eqLowGain,
      eqLowFreq: basePreset.eqLowFreq,
      eqMidGain: eqMidGain,
      eqMidFreq: basePreset.eqMidFreq,
      eqHighGain: eqHighGain,
      eqHighFreq: basePreset.eqHighFreq,
      compEnabled: basePreset.compEnabled,
      compThreshold: compThreshold,
      compRatio: compRatio,
      compAttack: basePreset.compAttack,
      compRelease: basePreset.compRelease,
      stereoWidth: stereoWidth,
      limiterBoost: limiterBoost
    }
  };
}

// ==========================================================================
// PRESET LOADER
// ==========================================================================
function loadGenrePreset(genreKey) {
  if (genreKey === 'custom') return;
  const p = GENRE_PRESETS[genreKey];
  if (!p) return;

  // 1. Copy presets into current params
  params.satEnabled = p.satEnabled;
  params.satType = p.satType;
  params.satDrive = p.satDrive;
  params.satMix = p.satMix;
  
  params.eqLowGain = p.eqLowGain;
  params.eqLowFreq = p.eqLowFreq;
  params.eqMidGain = p.eqMidGain;
  params.eqMidFreq = p.eqMidFreq;
  params.eqHighGain = p.eqHighGain;
  params.eqHighFreq = p.eqHighFreq;
  
  params.compEnabled = p.compEnabled;
  params.compThreshold = p.compThreshold;
  params.compRatio = p.compRatio;
  params.compAttack = p.compAttack;
  params.compRelease = p.compRelease;
  
  params.stereoWidth = p.stereoWidth;

  // Preserve or set limiter boost based on loudness target selection
  const loudnessSelect = document.getElementById('loudness-select');
  const loudnessKey = loudnessSelect ? loudnessSelect.value : 'genre';
  
  if (loudnessKey === 'genre') {
    params.limiterBoost = p.limiterBoost;
  } else if (LOUDNESS_TARGETS[loudnessKey] && LOUDNESS_TARGETS[loudnessKey].boost !== null) {
    params.limiterBoost = LOUDNESS_TARGETS[loudnessKey].boost;
  } else {
    // custom - keep current params.limiterBoost as is
  }

  // 2. Refresh HTML Controls
  updateGuiControls();
  
  // 3. Update Audio DSP
  updateInputGainNode();
  updateSaturatorNode();
  updateEqNodes();
  updateCompressorNode();
  updateStereoWidthNode();
  updateLimiterGainNode();
  updateCeilingNode();
}

function applyLoudnessTarget(targetKey) {
  if (targetKey === 'custom') return;
  
  if (targetKey === 'genre') {
    const genreSelect = document.getElementById('preset-select');
    const genreKey = genreSelect ? genreSelect.value : 'auto';
    const p = GENRE_PRESETS[genreKey] || GENRE_PRESETS.auto;
    params.limiterBoost = p.limiterBoost;
  } else {
    const t = LOUDNESS_TARGETS[targetKey];
    if (!t) return;
    params.limiterBoost = t.boost;
  }
  
  // Update GUI
  document.getElementById('limiter-gain').value = params.limiterBoost;
  document.getElementById('limiter-gain-val').innerText = `+${params.limiterBoost.toFixed(1)} dB`;
  
  // Update DSP
  updateLimiterGainNode();
}

// ==========================================================================
// MP3 ENCODING UTILITY (lamejs)
// ==========================================================================
function bufferToMp3(audioBuffer, bitrate) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  
  // Create LAME encoder
  const mp3encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, bitrate);
  
  const mp3Data = [];
  const sampleBlockSize = 1152;
  
  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : left;
  
  // Helper to convert float samples [-1, 1] to 16-bit Int16Array
  const convertSample = (s) => {
    if (s > 1.0) s = 1.0;
    else if (s < -1.0) s = -1.0;
    return s < 0 ? s * 0x8000 : s * 0x7FFF;
  };
  
  const leftInt = new Int16Array(left.length);
  const rightInt = new Int16Array(right.length);
  
  for (let i = 0; i < left.length; i++) {
    leftInt[i] = convertSample(left[i]);
    if (channels > 1) {
      rightInt[i] = convertSample(right[i]);
    }
  }
  
  for (let i = 0; i < leftInt.length; i += sampleBlockSize) {
    const leftChunk = leftInt.subarray(i, i + sampleBlockSize);
    const rightChunk = rightInt.subarray(i, i + sampleBlockSize);
    
    let mp3buf;
    if (channels === 2) {
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }
    
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));
    }
  }
  
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Int8Array(mp3buf));
  }
  
  return new Blob(mp3Data, { type: 'audio/mp3' });
}

// ==========================================================================
// OFFLINE WAV & MP3 EXPORT RENDERER
// ==========================================================================
async function renderMasteredTrack() {
  if (!audioBuffer) return;
  
  const format = document.getElementById('export-format').value;
  
  // Show UI progress
  const exportBtn = document.getElementById('btn-export');
  const progressContainer = document.getElementById('export-progress-bar');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('export-percentage');
  
  exportBtn.disabled = true;
  progressContainer.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressPercent.innerText = '0%';

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const duration = audioBuffer.duration;
  
  // Create offline context matching the source file
  const offlineCtx = new OfflineAudioContext(numChannels, sampleRate * duration, sampleRate);
  
  // Create offline buffer source
  const offlineSource = offlineCtx.createBufferSource();
  offlineSource.buffer = audioBuffer;
  
  // Set up the EXACT same signal chain in the offline context
  const offlineChain = setupMasteringChain(offlineCtx, offlineSource, params);
  offlineChain.outputNode.connect(offlineCtx.destination);
  
  offlineSource.start(0);

  // Poll progress (Web Audio doesn't have native progress callbacks, so we estimate)
  let progressPoll = setInterval(() => {
    // Offline rendering in browser is normally extremely fast, but we draw a smooth mock indicator
    let curWidth = parseFloat(progressFill.style.width) || 0;
    if (curWidth < 90) {
      curWidth += 15;
      progressFill.style.width = `${curWidth}%`;
      progressPercent.innerText = `${curWidth}%`;
    }
  }, 100);

  try {
    const renderedBuffer = await offlineCtx.startRendering();
    clearInterval(progressPoll);
    
    progressFill.style.width = '95%';
    progressPercent.innerText = '95% (Encoding...)';
    
    // UIスレッドを一時的に解放して描画を更新させてから、重いエンコード処理に入る
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let fileBlob;
    let fileExtension;
    
    if (format.startsWith('mp3')) {
      if (!window.lamejs) {
        logToUI("MP3 Encoder (lamejs) not loaded. Falling back to WAV.", "warning");
        alert("MP3エンコーダー（lamejs）が読み込めませんでした。WAV形式で保存します。");
        fileBlob = bufferToWav(renderedBuffer);
        fileExtension = 'wav';
      } else {
        const bitrate = format === 'mp3-320' ? 320 : 192;
        logToUI(`Encoding to MP3 (${bitrate} kbps)...`, "info");
        fileBlob = bufferToMp3(renderedBuffer, bitrate);
        fileExtension = 'mp3';
      }
    } else {
      logToUI("Encoding to WAV (16-bit PCM)...", "info");
      fileBlob = bufferToWav(renderedBuffer);
      fileExtension = 'wav';
    }
    
    progressFill.style.width = '100%';
    progressPercent.innerText = '100%';
    
    const downloadUrl = URL.createObjectURL(fileBlob);
    
    // Auto download trigger
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    const origName = document.getElementById('file-input').files[0]?.name || 'aether_master.wav';
    const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
    link.download = `${baseName}_mastered.${fileExtension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    document.getElementById('status-text').innerText = 'RENDER COMPLETE';
    logToUI(`Mastered file exported successfully as ${fileExtension.toUpperCase()}`, "info");
    
    // Auto reset uploader after 2 seconds
    setTimeout(() => {
      progressContainer.classList.add('hidden');
      exportBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    clearInterval(progressPoll);
    console.error('Offline rendering failed:', error);
    alert('エクスポートのレンダリング中にエラーが発生しました。');
    progressContainer.classList.add('hidden');
    exportBtn.disabled = false;
  }
}

// ==========================================================================
// GUI CONTROLLER BINDINGS & SYNCS
// ==========================================================================
function updateGuiControls() {
  // Input / Ceiling
  document.getElementById('input-gain-slider').value = params.inputGainDb;
  document.getElementById('input-gain-val').innerText = `${params.inputGainDb >= 0 ? '+' : ''}${params.inputGainDb.toFixed(1)} dB`;
  document.getElementById('ceiling-slider').value = params.ceiling;
  document.getElementById('ceiling-val').innerText = `${params.ceiling.toFixed(1)} dB`;
  
  // Saturator
  document.getElementById('sat-enable').checked = params.satEnabled;
  document.getElementById('sat-type').value = params.satType;
  document.getElementById('sat-drive-slider').value = params.satDrive;
  document.getElementById('sat-drive-val').innerText = `${params.satDrive}%`;
  document.getElementById('sat-mix-slider').value = params.satMix;
  document.getElementById('sat-mix-val').innerText = `${params.satMix}%`;
  
  // EQ
  document.getElementById('eq-low-gain').value = params.eqLowGain;
  document.getElementById('eq-low-freq').value = params.eqLowFreq;
  document.getElementById('eq-low-val').innerText = `${params.eqLowGain >= 0 ? '+' : ''}${params.eqLowGain.toFixed(1)} dB`;
  
  document.getElementById('eq-mid-gain').value = params.eqMidGain;
  document.getElementById('eq-mid-freq').value = params.eqMidFreq;
  document.getElementById('eq-mid-val').innerText = `${params.eqMidGain >= 0 ? '+' : ''}${params.eqMidGain.toFixed(1)} dB`;
  
  document.getElementById('eq-high-gain').value = params.eqHighGain;
  document.getElementById('eq-high-freq').value = params.eqHighFreq;
  document.getElementById('eq-high-val').innerText = `${params.eqHighGain >= 0 ? '+' : ''}${params.eqHighGain.toFixed(1)} dB`;
  
  // Compressor
  document.getElementById('comp-enable').checked = params.compEnabled;
  document.getElementById('comp-thresh').value = params.compThreshold;
  document.getElementById('comp-thresh-val').innerText = `${params.compThreshold.toFixed(1)} dB`;
  document.getElementById('comp-ratio').value = params.compRatio;
  document.getElementById('comp-ratio-val').innerText = `${params.compRatio.toFixed(1)}:1`;
  document.getElementById('comp-attack').value = params.compAttack;
  document.getElementById('comp-attack-val').innerText = `${Math.round(params.compAttack * 1000)} ms`;
  document.getElementById('comp-release').value = params.compRelease;
  document.getElementById('comp-release-val').innerText = `${Math.round(params.compRelease * 1000)} ms`;
  
  // Stereo Width
  document.getElementById('width-slider').value = params.stereoWidth;
  document.getElementById('width-val').innerText = `${Math.round(params.stereoWidth * 100)}%`;
  
  // Limiter Gain Boost
  document.getElementById('limiter-gain').value = params.limiterBoost;
  document.getElementById('limiter-gain-val').innerText = `+${params.limiterBoost.toFixed(1)} dB`;

  // Update Loudness Select dropdown if it mismatches
  const loudnessSelect = document.getElementById('loudness-select');
  if (loudnessSelect) {
    const curVal = loudnessSelect.value;
    if (curVal === 'genre') {
      const genreSelect = document.getElementById('preset-select');
      const genreKey = genreSelect ? genreSelect.value : 'auto';
      const p = GENRE_PRESETS[genreKey] || GENRE_PRESETS.auto;
      if (Math.abs(params.limiterBoost - p.limiterBoost) > 0.05) {
        loudnessSelect.value = 'custom';
      }
    } else if (curVal !== 'custom') {
      const target = LOUDNESS_TARGETS[curVal];
      if (!target || Math.abs(params.limiterBoost - target.boost) > 0.05) {
        loudnessSelect.value = 'custom';
      }
    }
  }
}

function updatePlayButtonUI(playing) {
  const btn = document.getElementById('btn-play-pause');
  if (playing) {
    btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    btn.className = 'ctrl-btn play-btn active';
  } else {
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    btn.className = 'ctrl-btn play-btn';
  }
}

function registerGuiEvents() {
  const selectCustomPreset = () => {
    document.getElementById('preset-select').value = 'custom';
  };

  // Input Gain / Ceiling
  document.getElementById('input-gain-slider').addEventListener('input', (e) => {
    params.inputGainDb = parseFloat(e.target.value);
    document.getElementById('input-gain-val').innerText = `${params.inputGainDb >= 0 ? '+' : ''}${params.inputGainDb.toFixed(1)} dB`;
    updateInputGainNode();
  });

  document.getElementById('ceiling-slider').addEventListener('input', (e) => {
    params.ceiling = parseFloat(e.target.value);
    document.getElementById('ceiling-val').innerText = `${params.ceiling.toFixed(1)} dB`;
    updateCeilingNode();
  });

  // Saturator
  document.getElementById('sat-enable').addEventListener('change', (e) => {
    params.satEnabled = e.target.checked;
    selectCustomPreset();
    updateSaturatorNode();
  });
  
  document.getElementById('sat-type').addEventListener('change', (e) => {
    params.satType = e.target.value;
    selectCustomPreset();
    updateSaturatorNode();
  });

  document.getElementById('sat-drive-slider').addEventListener('input', (e) => {
    params.satDrive = parseInt(e.target.value);
    document.getElementById('sat-drive-val').innerText = `${params.satDrive}%`;
    selectCustomPreset();
    updateSaturatorNode();
  });

  document.getElementById('sat-mix-slider').addEventListener('input', (e) => {
    params.satMix = parseInt(e.target.value);
    document.getElementById('sat-mix-val').innerText = `${params.satMix}%`;
    selectCustomPreset();
    updateSaturatorNode();
  });

  // EQ Low
  document.getElementById('eq-low-gain').addEventListener('input', (e) => {
    params.eqLowGain = parseFloat(e.target.value);
    document.getElementById('eq-low-val').innerText = `${params.eqLowGain >= 0 ? '+' : ''}${params.eqLowGain.toFixed(1)} dB`;
    selectCustomPreset();
    updateEqNodes();
  });
  document.getElementById('eq-low-freq').addEventListener('change', (e) => {
    params.eqLowFreq = Math.max(40, Math.min(250, parseInt(e.target.value)));
    e.target.value = params.eqLowFreq;
    selectCustomPreset();
    updateEqNodes();
  });

  // EQ Mid
  document.getElementById('eq-mid-gain').addEventListener('input', (e) => {
    params.eqMidGain = parseFloat(e.target.value);
    document.getElementById('eq-mid-val').innerText = `${params.eqMidGain >= 0 ? '+' : ''}${params.eqMidGain.toFixed(1)} dB`;
    selectCustomPreset();
    updateEqNodes();
  });
  document.getElementById('eq-mid-freq').addEventListener('change', (e) => {
    params.eqMidFreq = Math.max(300, Math.min(5000, parseInt(e.target.value)));
    e.target.value = params.eqMidFreq;
    selectCustomPreset();
    updateEqNodes();
  });

  // EQ High
  document.getElementById('eq-high-gain').addEventListener('input', (e) => {
    params.eqHighGain = parseFloat(e.target.value);
    document.getElementById('eq-high-val').innerText = `${params.eqHighGain >= 0 ? '+' : ''}${params.eqHighGain.toFixed(1)} dB`;
    selectCustomPreset();
    updateEqNodes();
  });
  document.getElementById('eq-high-freq').addEventListener('change', (e) => {
    params.eqHighFreq = Math.max(6000, Math.min(16000, parseInt(e.target.value)));
    e.target.value = params.eqHighFreq;
    selectCustomPreset();
    updateEqNodes();
  });

  // Compressor
  document.getElementById('comp-enable').addEventListener('change', (e) => {
    params.compEnabled = e.target.checked;
    selectCustomPreset();
    updateCompressorNode();
  });
  
  document.getElementById('comp-thresh').addEventListener('input', (e) => {
    params.compThreshold = parseFloat(e.target.value);
    document.getElementById('comp-thresh-val').innerText = `${params.compThreshold.toFixed(1)} dB`;
    selectCustomPreset();
    updateCompressorNode();
  });
  
  document.getElementById('comp-ratio').addEventListener('input', (e) => {
    params.compRatio = parseFloat(e.target.value);
    document.getElementById('comp-ratio-val').innerText = `${params.compRatio.toFixed(1)}:1`;
    selectCustomPreset();
    updateCompressorNode();
  });
  
  document.getElementById('comp-attack').addEventListener('input', (e) => {
    params.compAttack = parseFloat(e.target.value);
    document.getElementById('comp-attack-val').innerText = `${Math.round(params.compAttack * 1000)} ms`;
    selectCustomPreset();
    updateCompressorNode();
  });
  
  document.getElementById('comp-release').addEventListener('input', (e) => {
    params.compRelease = parseFloat(e.target.value);
    document.getElementById('comp-release-val').innerText = `${Math.round(params.compRelease * 1000)} ms`;
    selectCustomPreset();
    updateCompressorNode();
  });

  // Stereo Width
  document.getElementById('width-slider').addEventListener('input', (e) => {
    params.stereoWidth = parseFloat(e.target.value);
    document.getElementById('width-val').innerText = `${Math.round(params.stereoWidth * 100)}%`;
    selectCustomPreset();
    updateStereoWidthNode();
  });

  // Limiter Gain Boost
  document.getElementById('limiter-gain').addEventListener('input', (e) => {
    params.limiterBoost = parseFloat(e.target.value);
    document.getElementById('limiter-gain-val').innerText = `+${params.limiterBoost.toFixed(1)} dB`;
    // Selecting custom target
    document.getElementById('loudness-select').value = 'custom';
    updateLimiterGainNode();
  });

  // Preset Selections
  document.getElementById('preset-select').addEventListener('change', (e) => {
    loadGenrePreset(e.target.value);
    const autoRun = document.getElementById('ai-auto-run').checked;
    if (autoRun && audioBuffer) {
      runAiAnalysis(false);
    }
  });

  document.getElementById('loudness-select').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val !== 'custom') {
      baseLoudnessTarget = val;
    }
    applyLoudnessTarget(val);
    const autoRun = document.getElementById('ai-auto-run').checked;
    if (autoRun && audioBuffer) {
      runAiAnalysis(false);
    }
  });
  
  // Visualizer Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      activeTab = e.target.dataset.target;
      if (activeTab === 'spectrum') {
        document.getElementById('spectrum-view').classList.remove('hidden');
        document.getElementById('waveform-view').classList.add('hidden');
      } else {
        document.getElementById('spectrum-view').classList.add('hidden');
        document.getElementById('waveform-view').classList.remove('hidden');
        if (!isPlaying && audioBuffer) {
          drawWaveformView();
        }
      }
    });
  });
}

// ==========================================================================
// FILE HANDLER & DRAG-AND-DROP SETUP
// ==========================================================================
function setupFileLoader() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      loadAudioFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      loadAudioFile(files[0]);
    }
  });
}

function loadAudioFile(file) {
  if (isPlaying) {
    stopPlayback();
  }

  document.getElementById('status-text').innerText = 'LOADING AUDIO FILE...';
  document.getElementById('status-indicator').className = 'status-indicator processing';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result;
    
    // Create initial dummy audio context if not loaded
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    try {
      audioContext.decodeAudioData(arrayBuffer, (buffer) => {
        audioBuffer = buffer;
        
        // Downsample for waveform display
        originalPeaks = extractPeaks(audioBuffer, PEAK_POINTS);
        invalidatePeakCache();

        // Update UI info
        document.getElementById('track-name').innerText = file.name;
        
        const durationMin = Math.floor(buffer.duration / 60);
        const durationSec = Math.floor(buffer.duration % 60).toString().padStart(2, '0');
        const infoStr = `${buffer.sampleRate / 1000} kHz / ${buffer.numberOfChannels === 2 ? 'Stereo' : 'Mono'} | ${durationMin}:${durationSec}`;
        document.getElementById('track-meta').innerText = infoStr;

        // Display controls
        document.getElementById('track-info').classList.remove('hidden');
        document.body.classList.add('has-track');
        
        // Enable buttons
        document.getElementById('btn-play-pause').disabled = false;
        document.getElementById('btn-stop').disabled = false;
        document.getElementById('btn-loop').disabled = false;
        document.getElementById('btn-bypass').disabled = false;
        document.getElementById('btn-export').disabled = false;
        document.getElementById('btn-ai-analyze').disabled = false; // AIボタン有効化
        document.getElementById('btn-reset-master').disabled = false; // リセットボタン有効化
        
        // AIパラメータとレポートのリセット
        document.getElementById('ai-report').style.display = 'none';
        params.correctiveNotches.forEach(n => {
          n.enabled = false;
          n.gain = 0.0;
        });
        updateCorrectiveEqNodes();
        
        pausedAt = 0;
        playbackOffset = 0;
        
        document.getElementById('status-text').innerText = 'AUDIO LOADED SUCCESFULLY';
        document.getElementById('status-indicator').className = 'status-indicator online';

        // Load default AUTO preset
        baseLoudnessTarget = 'genre';
        document.getElementById('loudness-select').value = 'genre';
        document.getElementById('preset-select').value = 'auto';
        loadGenrePreset('auto');

        // Auto-run AI optimization on file load if checked
        const autoRun = document.getElementById('ai-auto-run').checked;
        if (autoRun) {
          runAiAnalysis(true);
        }

        // Draw initial static wave
        activeTab = 'waveform';
        document.querySelector('[data-target="waveform"]').click();
        drawWaveformView();
        
      }, (err) => {
        console.error('Audio decoding error:', err);
        alert('オーディオファイルのデコードに失敗しました。対応フォーマットをご確認ください。');
        document.getElementById('status-text').innerText = 'DECODE FAILED';
        document.getElementById('status-indicator').className = 'status-indicator online';
      });
    } catch (err) {
      console.error('decodeAudioData syntax error:', err);
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// ==========================================================================
// RESET MASTERING SETTINGS
// ==========================================================================
function resetMasterSettings() {
  if (!audioBuffer) return;
  
  invalidatePeakCache();
  logToUI("Resetting mastering parameters to AI Auto...", "info");
  
  // 1. Reset dropdown selections
  baseLoudnessTarget = 'genre';
  document.getElementById('preset-select').value = 'auto';
  document.getElementById('loudness-select').value = 'genre';
  
  // 2. Reset sibilance corrective notches
  params.correctiveNotches.forEach(n => {
    n.enabled = false;
    n.gain = 0.0;
  });
  updateCorrectiveEqNodes();
  
  // 3. Load the default genre preset
  loadGenrePreset('auto');
  
  // 4. Trigger AI auto-run if checked
  const autoRun = document.getElementById('ai-auto-run').checked;
  if (autoRun) {
    runAiAnalysis(true);
  } else {
    document.getElementById('ai-report').style.display = 'none';
  }
}

// ==========================================================================
// AI SMART ASSISTANT RUNNER
// ==========================================================================
function runAiAnalysis(showLog = true) {
  if (!audioBuffer) return;
  
  const aiAnalyzeBtn = document.getElementById('btn-ai-analyze');
  if (aiAnalyzeBtn) {
    aiAnalyzeBtn.disabled = true;
    aiAnalyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ANALYZING...';
  }
  
  if (showLog) {
    logToUI("AI Assistant: Analyzing frequency spectrum & dynamics...", "info");
  }
  
  setTimeout(() => {
    try {
      const result = analyzeAudioResonances(audioBuffer);
      
      // 5連ノッチフィルターの設定適用
      params.correctiveNotches.forEach((n, idx) => {
        if (result.notches[idx]) {
          n.freq = result.notches[idx].freq;
          n.gain = result.notches[idx].cut;
          n.enabled = true;
          if (showLog) {
            logToUI(`[AI Assistant] Detected harsh peak #${idx+1} at ${n.freq} Hz. Applied corrective cut of ${n.gain.toFixed(1)} dB.`, "warning");
          }
        } else {
          n.enabled = false;
          n.gain = 0.0;
        }
      });
      
      // 自動提案パラメーターの適用
      const sug = result.suggestedParams;
      params.inputGainDb = sug.inputGainDb;
      params.satEnabled = sug.satEnabled;
      params.satType = sug.satType;
      params.satDrive = sug.satDrive;
      params.satMix = sug.satMix;
      params.eqLowGain = sug.eqLowGain;
      params.eqMidGain = sug.eqMidGain;
      params.eqHighGain = sug.eqHighGain;
      params.compThreshold = sug.compThreshold;
      params.compRatio = sug.compRatio;
      params.stereoWidth = sug.stereoWidth;
      params.limiterBoost = sug.limiterBoost;
      
      // UIスライダーコントロールの同期
      updateGuiControls();
      
      // 現在再生中の音声ノードにパラメーターを反映
      updateInputGainNode();
      updateSaturatorNode();
      updateEqNodes();
      updateCompressorNode();
      updateStereoWidthNode();
      updateLimiterGainNode();
      updateCeilingNode();
      updateCorrectiveEqNodes();
      
      // AI詳細レポートカード表示の更新
      document.getElementById('ai-crest-factor').innerText = `${result.crestFactor.toFixed(1)} dB`;
      document.getElementById('ai-crest-desc').innerText = result.crestDesc;
      document.getElementById('ai-stereo-corr').innerText = `${result.correlation >= 0 ? '+' : ''}${result.correlation.toFixed(2)}`;
      document.getElementById('ai-stereo-desc').innerText = result.correlationDesc;
      
      const bassSign = result.bassDiff >= 0 ? '+' : '';
      document.getElementById('ai-bass-energy').innerText = `${bassSign}${result.bassDiff.toFixed(1)} dB`;
      document.getElementById('ai-bass-desc').innerText = result.bassDiff > 0.8 ? "Heavy Bass" : result.bassDiff < -0.8 ? "Weak Bass" : "Balanced Bass";
      
      const trebleSign = result.trebleDiff >= 0 ? '+' : '';
      document.getElementById('ai-treble-energy').innerText = `${trebleSign}${result.trebleDiff.toFixed(1)} dB`;
      document.getElementById('ai-treble-desc').innerText = result.trebleDiff > 0.8 ? "Bright / Sibilant" : result.trebleDiff < -0.8 ? "Warm / Dull" : "Balanced Highs";
      
      // ノッチフィルター検出リストのHTML生成
      const notchListContainer = document.getElementById('ai-notches-list');
      notchListContainer.innerHTML = '';
      if (result.notches.length > 0) {
        result.notches.forEach((n, idx) => {
          notchListContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 0, 85, 0.08); border-radius: 4px; padding: 4px 8px; border: 1px solid rgba(255, 0, 85, 0.15);">
              <span style="color: var(--text-secondary);"><i class="fa-solid fa-circle-notch"></i> PEAK ${idx+1}:</span>
              <span style="color: #fff; font-weight: 700;">${n.freq} Hz</span>
              <span style="color: var(--accent-red); font-weight: 700;">${n.cut.toFixed(1)} dB</span>
            </div>
          `;
        });
      } else {
        notchListContainer.innerHTML = '<div style="color: var(--text-muted); font-style: italic; padding: 4px;">No harsh resonances detected.</div>';
      }
      
      // 自動調整内容サマリーのHTML生成
      const adjContainer = document.getElementById('ai-adjustments-list');
      adjContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <span>INPUT GAIN:</span>
          <span style="color: #00f2fe; font-weight: 600;">${sug.inputGainDb >= 0 ? '+' : ''}${sug.inputGainDb.toFixed(1)} dB (Auto Gain)</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <span>EQ LOW:</span>
          <span style="color: #00f2fe; font-weight: 600;">${sug.eqLowGain >= 0 ? '+' : ''}${sug.eqLowGain.toFixed(1)} dB</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <span>EQ HIGH:</span>
          <span style="color: #00f2fe; font-weight: 600;">${sug.eqHighGain >= 0 ? '+' : ''}${sug.eqHighGain.toFixed(1)} dB</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <span>COMPRESSOR:</span>
          <span style="color: #00f2fe; font-weight: 600;">Thresh: ${sug.compThreshold.toFixed(1)} dB / Ratio: ${sug.compRatio.toFixed(1)}:1</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
          <span>STEREO WIDTH:</span>
          <span style="color: #00f2fe; font-weight: 600;">${Math.round(sug.stereoWidth * 100)}%</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; padding: 2px 4px;">
          <span>MAXIMIZER LIMITER:</span>
          <span style="color: #00f2fe; font-weight: 600;">Boost: +${sug.limiterBoost.toFixed(1)} dB</span>
        </div>
        <div style="text-align: right; font-size: 0.58rem; color: var(--text-muted); margin-top: -2px; padding: 0 4px 4px 0;">
          (Base: ${result.baseLoudnessDesc})
        </div>
      `;
      
      // レポート表示のフェードイン
      document.getElementById('ai-report').style.display = 'block';
      
      if (showLog) {
        logToUI("[AI Assistant] Optimization completed successfully. Audio nodes updated.", "info");
      }
    } catch (e) {
      console.error(e);
      logToUI(`AI analysis failed: ${e.message}`, "error");
    } finally {
      if (aiAnalyzeBtn) {
        aiAnalyzeBtn.disabled = false;
        aiAnalyzeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ANALYZE & AUTO-CORRECT EQ';
      }
    }
  }, 100);
}

// ==========================================================================
// MOBILE HELP BOTTOM SHEET INITIALIZER
// ==========================================================================
function initMobileHelp() {
  const tooltipElements = document.querySelectorAll('[data-tooltip]');
  const sheet = document.getElementById('mobile-help-sheet');
  const sheetTitle = document.getElementById('sheet-title');
  const sheetBody = document.getElementById('sheet-body');
  const closeBtn = document.getElementById('btn-close-sheet');
  const backdrop = document.getElementById('sheet-backdrop');

  if (!sheet || !sheetTitle || !sheetBody) return;

  function openSheet(title, text) {
    sheetTitle.textContent = title;
    sheetBody.textContent = text;
    sheet.classList.remove('hidden');
    // Force reflow
    sheet.offsetHeight;
    sheet.classList.add('active');
  }

  function closeSheet() {
    sheet.classList.remove('active');
    setTimeout(() => {
      sheet.classList.add('hidden');
    }, 300);
  }

  tooltipElements.forEach(el => {
    // If it's the reset button wrapper or reset button itself, skip mobile help tooltip completely to let the button work cleanly without popping up the sheet
    if (el.id === 'btn-reset-master' || el.querySelector('#btn-reset-master') || el.closest('#btn-reset-master')) {
      return;
    }

    // Add tabindex dynamically to make spans focusable/tappable
    el.setAttribute('tabindex', '0');

    el.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        e.stopPropagation();
        
        let titleText = "HELP";
        const tooltipText = el.getAttribute('data-tooltip') || "";
        
        const resetBtn = el.querySelector('#btn-reset-master');
        if (el.id === "btn-reset-master" || el.parentElement.id === "btn-reset-master" || resetBtn) {
          titleText = "RESET";
        } else {
          const parent = el.parentElement;
          if (parent) {
            const clone = parent.cloneNode(true);
            clone.querySelectorAll('[data-tooltip]').forEach(t => t.remove());
            titleText = clone.textContent.replace(/[\n\r\t]+/g, ' ').trim() || "HELP";
          }
        }
        
        openSheet(titleText, tooltipText);
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeSheet);
  if (backdrop) backdrop.addEventListener('click', closeSheet);
}

// ==========================================================================
// APP STARTUP BINDINGS
// ==========================================================================
function initializeApp() {
  setupFileLoader();
  registerGuiEvents();
  initMobileHelp();
  
  // Clear log button
  const clearLogBtn = document.getElementById('btn-clear-log');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      const logContainer = document.getElementById('debug-log');
      if (logContainer) {
        logContainer.innerHTML = '<div class="log-line info" style="color: #00f2fe;">[SYSTEM] Log cleared.</div>';
      }
    });
  }
  
  // Play/Pause button
  document.getElementById('btn-play-pause').addEventListener('click', () => {
    logToUI("Play/Pause button clicked", "info");
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  });

  // Spacebar Play/Pause Shortcut
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      const activeEl = document.activeElement;
      if (activeEl && (
        (activeEl.tagName === 'INPUT' && activeEl.type !== 'range') ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      )) {
        return;
      }
      
      const playBtn = document.getElementById('btn-play-pause');
      if (playBtn && !playBtn.disabled && audioBuffer) {
        e.preventDefault();
        if (isPlaying) {
          pausePlayback();
        } else {
          startPlayback();
        }
      }
    }
  });

  // Stop button
  document.getElementById('btn-stop').addEventListener('click', () => {
    stopPlayback();
  });

  // Loop Toggle
  const loopBtn = document.getElementById('btn-loop');
  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    if (isLooping) {
      loopBtn.classList.add('active');
    } else {
      loopBtn.classList.remove('active');
    }
    if (sourceNode) {
      sourceNode.loop = isLooping;
    }
  });

  // Bypass (A/B Test) Toggle
  const bypassBtn = document.getElementById('btn-bypass');
  bypassBtn.addEventListener('click', () => {
    isBypassed = !isBypassed;
    if (isBypassed) {
      bypassBtn.classList.add('active');
    } else {
      bypassBtn.classList.remove('active');
    }
    updateBypassRouting();
  });

  // Export button
  document.getElementById('btn-export').addEventListener('click', () => {
    renderMasteredTrack();
  });
  
  // AI Analyze Button click handler
  const aiAnalyzeBtn = document.getElementById('btn-ai-analyze');
  if (aiAnalyzeBtn) {
    aiAnalyzeBtn.addEventListener('click', () => {
      runAiAnalysis(true);
    });
  }
  
  // Reset Button click handler
  const resetBtn = document.getElementById('btn-reset-master');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetMasterSettings();
    });
  }
  
  // Waveform click seeking & scrubbing
  const waveformCanvas = document.getElementById('waveform-canvas');
  if (waveformCanvas) {
    waveformCanvas.style.cursor = 'pointer';
    let isMouseDown = false;
    
    const handleSeek = (e) => {
      if (!audioBuffer) return;
      const rect = waveformCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = Math.max(0, Math.min(1.0, clickX / rect.width));
      const seekTime = clickPercent * audioBuffer.duration;
      seekTo(seekTime);
    };
    
    waveformCanvas.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      handleSeek(e);
    });
    
    window.addEventListener('mousemove', (e) => {
      if (isMouseDown) {
        handleSeek(e);
      }
    });
    
    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });
  }
  
  // Mobile monitor toggle (collapse/expand)
  const toggleMonitorBtn = document.getElementById('btn-toggle-monitor');
  if (toggleMonitorBtn) {
    toggleMonitorBtn.addEventListener('click', () => {
      const panel = document.querySelector('.visualizer-panel');
      if (panel) {
        panel.classList.toggle('collapsed');
      }
    });
  }

  // Relocate player controls dynamically based on screen size
  relocatePlayerControls();
  window.addEventListener('resize', relocatePlayerControls);

  // Initialize width beam animation angle L/R
  updateStereoWidthNode();
}

// Bulletproof execution strategy for DOM initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Relocate player controls (Play/Pause, Stop, Loop, Bypass) to sticky visualizer header on mobile
function relocatePlayerControls() {
  const controls = document.querySelector('.player-controls');
  if (!controls) return;
  
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    const mobileTarget = document.getElementById('mobile-controls-target');
    if (mobileTarget && controls.parentElement !== mobileTarget) {
      mobileTarget.appendChild(controls);
    }
  } else {
    const desktopTarget = document.getElementById('desktop-controls-target');
    if (desktopTarget && controls.parentElement !== desktopTarget) {
      desktopTarget.appendChild(controls);
    }
  }
}

// Performance Optimization: Cache processed peaks calculations
function invalidatePeakCache() {
  cachedProcessedPeaks = null;
  // 音源ロード済かつ一時停止中の場合、パラメータ変更に伴う波形表示を即座に更新する
  if (!isPlaying && audioBuffer && activeTab === 'waveform') {
    drawWaveformView();
  }
}

function getProcessedPeaks() {
  if (!cachedProcessedPeaks) {
    cachedProcessedPeaks = calculateProcessedPeaks();
  }
  return cachedProcessedPeaks;
}
