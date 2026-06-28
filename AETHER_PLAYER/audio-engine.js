/**
 * AetherEnhancer - Web Audio API Mastering Engine
 * Adapted from AetherMaster AI AUTO engine.
 */

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

// AI Spectral Analysis & Auto-EQ algorithm from AetherMaster
export function analyzeAudioResonances(buffer) {
  const fftSize = 2048;
  const numSlices = 32; // Analyze 32 slices across the buffer
  const sampleRate = buffer.sampleRate;
  const chL = buffer.getChannelData(0);
  const chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;
  
  const avgSpectrum = new Float32Array(fftSize / 2);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  
  // Calculate slice points (skip first and last 10% to avoid silent intro/outro)
  const slicePoints = [];
  const startOffset = Math.floor(buffer.length * 0.1);
  const endOffset = Math.floor(buffer.length * 0.9);
  const range = endOffset - startOffset;
  for (let i = 0; i < numSlices; i++) {
    slicePoints.push(startOffset + Math.floor(range * (i / (numSlices - 1))));
  }
  
  const sliceRMSList = [];
  const sliceSpectrums = [];
  
  let totalEnergyL2 = 0;
  let totalEnergyR2 = 0;
  let totalDotProduct = 0;
  let maxAbsSample = 0.0;
  let sumRMS2 = 0.0;

  for (const startIdx of slicePoints) {
    let sliceMax = 0.0;
    let sliceSumSq = 0.0;
    
    let sliceDotProduct = 0;
    let sliceSumL2 = 0;
    let sliceSumR2 = 0;

    for (let j = 0; j < fftSize; j++) {
      const idx = startIdx + j;
      if (idx >= buffer.length) break;

      const l = chL[idx];
      const r = chR[idx];
      const mid = (l + r) * 0.5;

      re[j] = mid;
      im[j] = 0;

      const absMid = Math.abs(mid);
      if (absMid > sliceMax) sliceMax = absMid;
      sliceSumSq += mid * mid;

      sliceDotProduct += l * r;
      sliceSumL2 += l * l;
      sliceSumR2 += r * r;
    }
    
    if (sliceMax > maxAbsSample) maxAbsSample = sliceMax;
    
    const sliceRMS = Math.sqrt(sliceSumSq / fftSize);
    sumRMS2 += sliceRMS * sliceRMS;

    totalDotProduct += sliceDotProduct;
    totalEnergyL2 += sliceSumL2;
    totalEnergyR2 += sliceSumR2;

    // Apply Hanning Window
    for (let j = 0; j < fftSize; j++) {
      const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * j) / (fftSize - 1)));
      re[j] *= windowVal;
    }
    
    fft(re, im);
    
    const spec = new Float32Array(fftSize / 2);
    for (let j = 0; j < fftSize / 2; j++) {
      const mag = Math.sqrt(re[j] * re[j] + im[j] * im[j]);
      avgSpectrum[j] += mag / numSlices;
      spec[j] = mag;
    }
    sliceSpectrums.push(spec);
    sliceRMSList.push(sliceRMS);
  }

  // Crest Factor (dB)
  const avgRMS = Math.sqrt(sumRMS2 / numSlices);
  const crestRatio = maxAbsSample / (avgRMS + 1e-6);
  const crestFactorDb = Math.max(0.0, 20 * Math.log10(crestRatio));

  // Stereo Correlation (-1.0 to 1.0)
  let avgCorrelation = 1.0;
  if (totalEnergyL2 > 0 && totalEnergyR2 > 0) {
    avgCorrelation = totalDotProduct / Math.sqrt(totalEnergyL2 * totalEnergyR2);
    avgCorrelation = Math.max(-1.0, Math.min(1.0, avgCorrelation));
  }

  // Energy by bands
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

  const actualLowMidRatio = lowEnergy / (midEnergy + 1e-6);
  const actualHighMidRatio = highEnergy / (midEnergy + 1e-6);

  // Noise Floor Estimation
  let minRmsIdx = 0;
  let minRmsVal = 1.0;
  for (let i = 0; i < sliceRMSList.length; i++) {
    if (sliceRMSList[i] < minRmsVal) {
      minRmsVal = sliceRMSList[i];
      minRmsIdx = i;
    }
  }

  const binHissStart = Math.floor((6000 * fftSize) / sampleRate);
  const binHissEnd = Math.floor((15000 * fftSize) / sampleRate);
  let hissSum = 0;
  for (let j = binHissStart; j <= binHissEnd; j++) {
    hissSum += sliceSpectrums[minRmsIdx][j];
  }
  const hissNoiseFloor = hissSum / (binHissEnd - binHissStart + 1);
  const hissNoiseFloorDb = 20 * Math.log10(hissNoiseFloor + 1e-6);

  const binRumbleStart = Math.floor((20 * fftSize) / sampleRate);
  const binRumbleEnd = Math.floor((60 * fftSize) / sampleRate);
  let rumbleSum = 0;
  for (let j = binRumbleStart; j <= binRumbleEnd; j++) {
    rumbleSum += sliceSpectrums[minRmsIdx][j];
  }
  const rumbleNoiseFloor = rumbleSum / (binRumbleEnd - binRumbleStart + 1);
  const rumbleNoiseFloorDb = 20 * Math.log10(rumbleNoiseFloor + 1e-6);

  let sugRumbleCut = false;
  if (rumbleNoiseFloorDb > -48.0) sugRumbleCut = true;

  let sugHissAmount = 0;
  if (hissNoiseFloorDb > -56.0) {
    sugHissAmount = Math.round(Math.max(0, Math.min(80, (hissNoiseFloorDb + 56.0) * 4.0)));
  }

  // Sibilance peak scanning (5kHz - 12kHz)
  const sibilanceMinBin = Math.floor((5000 * fftSize) / sampleRate);
  const sibilanceMaxBin = Math.floor((12000 * fftSize) / sampleRate);
  let sumRegion = 0;
  for (let j = sibilanceMinBin; j <= sibilanceMaxBin; j++) {
    sumRegion += avgSpectrum[j];
  }
  const sibilanceBaseline = sumRegion / (sibilanceMaxBin - sibilanceMinBin + 1);
  
  const rawPeaks = [];
  for (let j = sibilanceMinBin + 1; j < sibilanceMaxBin; j++) {
    const val = avgSpectrum[j];
    const peakFreq = Math.round((j * sampleRate) / fftSize);
    
    // Suno AI sibilance range 9kHz - 10kHz
    const isSunoRange = (peakFreq >= 8800 && peakFreq <= 10200);
    const thresholdMultiplier = isSunoRange ? 1.16 : 1.32;
    
    if (val > sibilanceBaseline * thresholdMultiplier && val > avgSpectrum[j - 1] && val > avgSpectrum[j + 1]) {
      const ratio = val / sibilanceBaseline;
      let cutDb;
      if (isSunoRange) {
        cutDb = -Math.min(3.5, Math.max(1.5, (ratio - 1.16) * 6.0 + 1.5));
      } else {
        cutDb = -Math.min(2.5, Math.max(1.0, (ratio - 1.32) * 4.0 + 1.0));
      }
      if (peakFreq < 8500) cutDb *= 0.5;
      
      rawPeaks.push({
        freq: peakFreq,
        cut: cutDb,
        val: val,
        isSunoRange: isSunoRange,
        score: ratio * (isSunoRange ? 2.0 : 1.0)
      });
    }
  }

  rawPeaks.sort((a, b) => b.score - a.score);

  const filteredPeaks = [];
  for (const peak of rawPeaks) {
    if (filteredPeaks.length >= 4) break;
    const tooClose = filteredPeaks.some(p => Math.abs(p.freq - peak.freq) < 400);
    if (!tooClose) {
      filteredPeaks.push({ freq: peak.freq, cut: peak.cut });
    }
  }

  // Base preset for AI AUTO
  const basePreset = {
    satEnabled: true, satType: 'tape', satDrive: 10, satMix: 10,
    eqLowGain: 0.0, eqLowFreq: 120,
    eqMidGain: 0.0, eqMidFreq: 1000, eqMidQ: 1.0,
    eqHighGain: 0.0, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -15.0, compRatio: 1.6, compAttack: 0.03, compRelease: 0.15,
    stereoWidth: 1.15, limiterBoost: 3.5, sideHighPassFreq: 110
  };

  // AI AUTO target ratio: standard studio reference values
  const target = { low: 2.8, high: 0.15 };

  // energy difference in dB
  const lowDiffDb = 20 * Math.log10(actualLowMidRatio / target.low);
  const highDiffDb = 20 * Math.log10(actualHighMidRatio / target.high);

  let eqLowAdjustment = 0;
  if (lowDiffDb > 0.5) {
    eqLowAdjustment = -Math.min(3.5, lowDiffDb * 0.75);
  } else if (lowDiffDb < -0.5) {
    eqLowAdjustment = Math.min(3.0, -lowDiffDb * 0.75);
  }
  const eqLowGain = Math.max(-5.0, Math.min(3.5, Math.round((basePreset.eqLowGain + eqLowAdjustment) * 2) / 2));

  let eqHighAdjustment = 0;
  if (highDiffDb > 0.5) {
    eqHighAdjustment = -Math.min(3.0, highDiffDb * 0.8);
  } else if (highDiffDb < -0.5) {
    eqHighAdjustment = Math.min(3.0, -highDiffDb * 0.8);
  }
  const eqHighGain = Math.max(-5.0, Math.min(4.0, Math.round((basePreset.eqHighGain + eqHighAdjustment) * 2) / 2));

  const eqMidGain = basePreset.eqMidGain;
  const baseBoost = 3.5; // Limiter default boost for auto preset

  // Crest factor analysis
  let compThreshold = basePreset.compThreshold;
  let compRatio = basePreset.compRatio;
  let limiterBoost = baseBoost;

  const targetCrest = 11.0; // AI AUTO target crest factor
  const crestDiff = crestFactorDb - targetCrest;
  if (crestDiff > 1.5) {
    compThreshold = -14.0;
    compRatio = 1.8;
    const bonus = Math.min(1.0, crestDiff * 0.25);
    limiterBoost = baseBoost + bonus;
  } else if (crestDiff < -1.5) {
    compThreshold = -8.0;
    compRatio = 1.25;
    const penalty = Math.min(2.5, -crestDiff * 0.40);
    limiterBoost = baseBoost - penalty;
  }

  limiterBoost = Math.max(0.0, Math.min(10.0, Math.round(limiterBoost * 10) / 10));

  // Stereo Width adjustment
  let stereoWidth = basePreset.stereoWidth;
  if (avgCorrelation > 0.8) {
    stereoWidth = Math.min(2.0, basePreset.stereoWidth + 0.2);
  } else if (avgCorrelation < 0.45) {
    stereoWidth = Math.max(1.0, basePreset.stereoWidth - 0.15);
  }

  // Saturator adjustment
  let satDrive = basePreset.satDrive;
  let satMix = basePreset.satMix;
  if (highDiffDb > 1.5) {
    satDrive = Math.max(1, basePreset.satDrive - 5);
    satMix = Math.max(0, basePreset.satMix - 8);
  } else if (highDiffDb < -1.5) {
    satDrive = Math.min(100, basePreset.satDrive + 5);
    satMix = Math.min(100, basePreset.satMix + 5);
  }

  // Gain staging
  const originalPeakDb = 20 * Math.log10(maxAbsSample + 1e-6);
  const suggestedInputGainDb = Math.max(-12.0, Math.min(12.0, -6.0 - originalPeakDb));

  return {
    detected: filteredPeaks.length > 0,
    notches: filteredPeaks,
    crestFactor: crestFactorDb,
    correlation: avgCorrelation,
    bassDiff: lowDiffDb,
    trebleDiff: highDiffDb,
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
      eqMidQ: basePreset.eqMidQ || 1.0,
      eqHighGain: eqHighGain,
      eqHighFreq: basePreset.eqHighFreq,
      compEnabled: basePreset.compEnabled,
      compThreshold: compThreshold,
      compRatio: compRatio,
      compAttack: basePreset.compAttack,
      compRelease: basePreset.compRelease,
      stereoWidth: stereoWidth,
      sideHighPassFreq: basePreset.sideHighPassFreq || 110,
      limiterBoost: limiterBoost,
      rumbleCutEnabled: sugRumbleCut,
      hissReductionAmount: sugHissAmount
    }
  };
}

export class AetherEnhancer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.isBypassed = false;

    // Create bypass crossfade nodes
    this.inputNode = this.ctx.createGain();
    this.outputNode = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();

    // Setup bypass routing
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // Initial state: Enhancer active (dry=0, wet=1)
    this.dryGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.wetGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Build the Enhancer Chain
    this._buildChain();

    // Connect Enhancer Chain output to wetGain
    this.ceilingGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    // Set default parameters (neutral start)
    this.setMasteringParams({
      inputGainDb: 0.0,
      satEnabled: true,
      satType: 'tape',
      satDrive: 10,
      satMix: 10,
      eqLowGain: 0.0,
      eqLowFreq: 120,
      eqMidGain: 0.0,
      eqMidFreq: 1000,
      eqMidQ: 1.0,
      eqHighGain: 0.0,
      eqHighFreq: 10000,
      compEnabled: true,
      compThreshold: -15.0,
      compRatio: 1.6,
      compAttack: 0.03,
      compRelease: 0.15,
      stereoWidth: 1.15,
      sideHighPassFreq: 110,
      limiterBoost: 3.5,
      rumbleCutEnabled: false,
      hissReductionAmount: 0
    }, []);
  }

  _buildChain() {
    const context = this.ctx;

    // 1. Input Gain node
    this.inputGainNode = context.createGain();
    this.inputGainNode.gain.setValueAtTime(1.0, context.currentTime);

    // 2. Rumble high-pass filter
    this.rumbleFilter = context.createBiquadFilter();
    this.rumbleFilter.type = 'highpass';
    this.rumbleFilter.frequency.setValueAtTime(10.0, context.currentTime);
    this.rumbleFilter.Q.setValueAtTime(0.707, context.currentTime);

    // 3. Dynamic Hiss Filter (VCF Lowpass)
    this.hissFilter = context.createBiquadFilter();
    this.hissFilter.type = 'lowpass';
    this.hissFilter.frequency.setValueAtTime(20000.0, context.currentTime);
    this.hissFilter.Q.setValueAtTime(0.5, context.currentTime);

    // 3b. Sidechain Envelope Follower
    this.sidechainHpf = context.createBiquadFilter();
    this.sidechainHpf.type = 'highpass';
    this.sidechainHpf.frequency.setValueAtTime(4000.0, context.currentTime);
    this.sidechainHpf.Q.setValueAtTime(0.707, context.currentTime);

    this.rectifier = context.createWaveShaper();
    this.rectifier.curve = this._generateAbsoluteValCurve();

    this.envelopeSmoother = context.createBiquadFilter();
    this.envelopeSmoother.type = 'lowpass';
    this.envelopeSmoother.frequency.setValueAtTime(10.0, context.currentTime);
    this.envelopeSmoother.Q.setValueAtTime(0.707, context.currentTime);

    this.hissEnvelopeGain = context.createGain();
    this.hissEnvelopeGain.gain.setValueAtTime(0.0, context.currentTime);

    // Hiss sidechain connections
    this.rumbleFilter.connect(this.sidechainHpf);
    this.sidechainHpf.connect(this.rectifier);
    this.rectifier.connect(this.envelopeSmoother);
    this.envelopeSmoother.connect(this.hissEnvelopeGain);
    this.hissEnvelopeGain.connect(this.hissFilter.frequency);

    // 4. Parallel Saturation
    this.satDryGain = context.createGain();
    this.satWetGain = context.createGain();
    this.waveShaper = context.createWaveShaper();
    this.satSumNode = context.createGain();

    this.waveShaper.curve = this._generateSaturatorCurve('tape', 10.0);
    this.waveShaper.oversample = 'none';

    // Hook up main input path to saturation
    this.inputNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.rumbleFilter);
    this.rumbleFilter.connect(this.hissFilter);

    this.hissFilter.connect(this.satDryGain);
    this.hissFilter.connect(this.waveShaper);
    this.waveShaper.connect(this.satWetGain);

    this.satDryGain.connect(this.satSumNode);
    this.satWetGain.connect(this.satSumNode);

    // 5. EQ Section (4-band cascade)
    this.eqLow = context.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.setValueAtTime(120.0, context.currentTime);

    this.kickPeaking = context.createBiquadFilter();
    this.kickPeaking.type = 'peaking';
    this.kickPeaking.frequency.setValueAtTime(70.0, context.currentTime);
    this.kickPeaking.Q.setValueAtTime(1.2, context.currentTime);

    this.eqMid = context.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.setValueAtTime(1000.0, context.currentTime);
    this.eqMid.Q.setValueAtTime(1.0, context.currentTime);

    this.eqHigh = context.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.setValueAtTime(10000.0, context.currentTime);

    // 6. Corrective Notch Filters (8-band cascade)
    for (let i = 1; i <= 8; i++) {
      this[`eqCorrective${i}`] = context.createBiquadFilter();
      this[`eqCorrective${i}`].type = 'peaking';
      this[`eqCorrective${i}`].frequency.setValueAtTime(1000.0, context.currentTime);
      this[`eqCorrective${i}`].gain.setValueAtTime(0.0, context.currentTime);
      this[`eqCorrective${i}`].Q.setValueAtTime(12.0, context.currentTime);
    }

    // Connect EQ chain
    this.satSumNode.connect(this.eqLow);
    this.eqLow.connect(this.kickPeaking);
    this.kickPeaking.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);

    // Cascade corrective filters
    this.eqHigh.connect(this.eqCorrective1);
    this.eqCorrective1.connect(this.eqCorrective2);
    this.eqCorrective2.connect(this.eqCorrective3);
    this.eqCorrective3.connect(this.eqCorrective4);
    this.eqCorrective4.connect(this.eqCorrective5);
    this.eqCorrective5.connect(this.eqCorrective6);
    this.eqCorrective6.connect(this.eqCorrective7);
    this.eqCorrective7.connect(this.eqCorrective8);

    // 7. Dynamics Compressor
    this.compressor = context.createDynamicsCompressor();
    this.compressor.knee.setValueAtTime(6.0, context.currentTime);
    this.compressor.threshold.setValueAtTime(-15.0, context.currentTime);
    this.compressor.ratio.setValueAtTime(1.6, context.currentTime);
    this.compressor.attack.setValueAtTime(0.03, context.currentTime);
    this.compressor.release.setValueAtTime(0.15, context.currentTime);

    this.eqCorrective8.connect(this.compressor);

    // 8. Mid-Side Stereo Imager Matrix
    this.splitter = context.createChannelSplitter(2);
    this.midSum = context.createGain();
    this.sideDiff = context.createGain();

    this.leftToMid = context.createGain(); this.leftToMid.gain.setValueAtTime(0.5, context.currentTime);
    this.rightToMid = context.createGain(); this.rightToMid.gain.setValueAtTime(0.5, context.currentTime);
    this.leftToSide = context.createGain(); this.leftToSide.gain.setValueAtTime(0.5, context.currentTime);
    this.rightToSide = context.createGain(); this.rightToSide.gain.setValueAtTime(-0.5, context.currentTime);

    this.compressor.connect(this.splitter);

    this.splitter.connect(this.leftToMid, 0);
    this.splitter.connect(this.rightToMid, 1);
    this.leftToMid.connect(this.midSum);
    this.rightToMid.connect(this.midSum);

    this.splitter.connect(this.leftToSide, 0);
    this.splitter.connect(this.rightToSide, 1);
    this.leftToSide.connect(this.sideDiff);
    this.rightToSide.connect(this.sideDiff);

    this.midGain = context.createGain();
    this.sideGain = context.createGain();

    this.sideHighPass = context.createBiquadFilter();
    this.sideHighPass.type = 'highpass';
    this.sideHighPass.frequency.setValueAtTime(110.0, context.currentTime);
    this.sideHighPass.Q.setValueAtTime(0.707, context.currentTime);

    this.midSum.connect(this.midGain);
    this.sideDiff.connect(this.sideHighPass);
    this.sideHighPass.connect(this.sideGain);

    // Decode to stereo
    this.leftSum = context.createGain();
    this.rightDiff = context.createGain();
    this.sideInverter = context.createGain();
    this.sideInverter.gain.setValueAtTime(-1.0, context.currentTime);

    this.midGain.connect(this.leftSum);
    this.sideGain.connect(this.leftSum);

    this.midGain.connect(this.rightDiff);
    this.sideGain.connect(this.sideInverter);
    this.sideInverter.connect(this.rightDiff);

    this.merger = context.createChannelMerger(2);
    this.leftSum.connect(this.merger, 0, 0);
    this.rightDiff.connect(this.merger, 0, 1);

    // 9. Maximizer & Limiter
    this.limiterGain = context.createGain();
    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(0.0, context.currentTime);
    this.limiter.knee.setValueAtTime(3.0, context.currentTime);
    this.limiter.ratio.setValueAtTime(20.0, context.currentTime);
    this.limiter.attack.setValueAtTime(0.0001, context.currentTime);
    this.limiter.release.setValueAtTime(0.08, context.currentTime);

    this.safetyClipper = context.createWaveShaper();
    this.safetyClipper.curve = this._generateSoftClipCurve();
    this.safetyClipper.oversample = '2x';

    this.merger.connect(this.limiterGain);
    this.limiterGain.connect(this.limiter);
    this.limiter.connect(this.safetyClipper);

    // 10. Output ceiling gain
    this.ceilingGain = context.createGain();
    this.ceilingGain.gain.setValueAtTime(Math.pow(10, -0.2 / 20), context.currentTime);

    this.safetyClipper.connect(this.ceilingGain);
  }

  setMasteringParams(params, notches) {
    const t = this.ctx.currentTime;

    // 1. Input Gain stage
    const inputGain = Math.pow(10, (params.inputGainDb || 0.0) / 20.0);
    this.inputGainNode.gain.setTargetAtTime(inputGain, t, 0.05);

    // 2. Rumble Filter
    if (params.rumbleCutEnabled) {
      this.rumbleFilter.frequency.setTargetAtTime(30.0, t, 0.05);
    } else {
      this.rumbleFilter.frequency.setTargetAtTime(10.0, t, 0.05);
    }

    // 3. Hiss Reduction
    const hissAmount = params.hissReductionAmount || 0;
    const baseFreq = 20000.0 - (16000.0 * (hissAmount / 100.0));
    this.hissFilter.frequency.setTargetAtTime(baseFreq, t, 0.05);
    const maxEnvGain = 35000.0 * (hissAmount / 100.0);
    this.hissEnvelopeGain.gain.setTargetAtTime(maxEnvGain, t, 0.05);

    // 4. Parallel Saturation
    const blend = params.satMix / 100.0;
    this.satDryGain.gain.setTargetAtTime(1.0 - blend, t, 0.05);
    this.satWetGain.gain.setTargetAtTime(blend, t, 0.05);
    this.waveShaper.curve = this._generateSaturatorCurve(params.satType, params.satDrive);

    // 5. 3-band EQ + kick Peaking
    this.eqLow.gain.setTargetAtTime(params.eqLowGain, t, 0.05);
    this.kickPeaking.gain.setTargetAtTime(1.5, t, 0.05); // Standard +1.5 dB kick punch
    this.eqMid.gain.setTargetAtTime(params.eqMidGain, t, 0.05);
    this.eqHigh.gain.setTargetAtTime(params.eqHighGain, t, 0.05);

    // 6. Corrective Notch Filters
    this.setCorrectiveNotches(notches);

    // 7. Glue Compressor
    if (params.compEnabled) {
      this.compressor.threshold.setTargetAtTime(params.compThreshold, t, 0.05);
      this.compressor.ratio.setTargetAtTime(params.compRatio, t, 0.05);
    } else {
      this.compressor.threshold.setTargetAtTime(0.0, t, 0.05);
      this.compressor.ratio.setTargetAtTime(1.0, t, 0.05);
    }

    // 8. Stereo Width
    this.sideGain.gain.setTargetAtTime(params.stereoWidth, t, 0.05);

    // 9. Maximizer Gain
    const linearBoost = Math.pow(10, (params.limiterBoost || 0.0) / 20.0);
    this.limiterGain.gain.setTargetAtTime(linearBoost, t, 0.05);
  }

  setCorrectiveNotches(notches) {
    const t = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const filter = this[`eqCorrective${i+1}`];
      if (notches && notches[i]) {
        filter.frequency.setTargetAtTime(notches[i].freq, t, 0.05);
        filter.gain.setTargetAtTime(notches[i].cut, t, 0.05);
        filter.Q.setTargetAtTime(12.0, t, 0.05);
      } else {
        filter.gain.setTargetAtTime(0.0, t, 0.05); // Neutral / Disabled
      }
    }
  }

  setBypass(active) {
    const t = this.ctx.currentTime;
    this.isBypassed = active;
    if (active) {
      this.dryGain.gain.setTargetAtTime(1.0, t, 0.08);
      this.wetGain.gain.setTargetAtTime(0.0, t, 0.08);
    } else {
      this.dryGain.gain.setTargetAtTime(0.0, t, 0.08);
      this.wetGain.gain.setTargetAtTime(1.0, t, 0.08);
    }
  }

  // --- Helper WaveShaper Curve Generators ---

  _generateAbsoluteValCurve() {
    const n_samples = 1024;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / (n_samples - 1) - 1;
      curve[i] = Math.abs(x);
    }
    return curve;
  }

  _generateSoftClipCurve() {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const threshold = 0.85;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      const absX = Math.abs(x);
      if (absX <= threshold) {
        curve[i] = x;
      } else {
        const sign = Math.sign(x);
        const excess = (absX - threshold) / (1.0 - threshold);
        const y = threshold + (1.0 - threshold) * (-Math.pow(excess, 3) + Math.pow(excess, 2) + excess);
        curve[i] = sign * y;
      }
    }
    return curve;
  }

  _generateSaturatorCurve(type, drive) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);

    if (type === 'tube') {
      const k = 0.5 + (drive / 100) * 8.5;
      const offset = 0.12;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        const x_off = x + offset;
        const y = Math.tanh(k * x_off);
        curve[i] = y - Math.tanh(k * offset);
      }
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
      const k = 0.5 + (drive / 100) * 5.5;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = Math.tanh(k * x) / Math.tanh(k);
      }
    } else {
      for (let i = 0; i < n_samples; ++i) {
        curve[i] = (i * 2) / n_samples - 1;
      }
    }
    return curve;
  }
}
