/**
 * AetherEnhancer - Web Audio API Mastering Engine
 * Automatically synced from audio-mastering-tool/app.js.
 */

// Global mock state required by analyzeAudioResonances
const baseLoudnessTarget = 'genre';
const params = { limiterBoost: 3.5 };

export const GENRE_PRESETS = {
  auto: {
    satEnabled: true, satType: 'tube', satDrive: 12, satMix: 10,
    eqLowGain: 0.0, eqLowFreq: 90,
    eqMidGain: 0.0, eqMidFreq: 1000, eqMidQ: 1.0,
    eqHighGain: 0.0, eqHighFreq: 9000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.35, compAttack: 0.04, compRelease: 0.20,
    stereoWidth: 1.15, limiterBoost: 3.5, sideHighPassFreq: 110
  },
  pops: {
    satEnabled: true, satType: 'tube', satDrive: 15, satMix: 10,
    eqLowGain: 1.5, eqLowFreq: 100,
    eqMidGain: 0.6, eqMidFreq: 1800, eqMidQ: 1.0,
    eqHighGain: 1.0, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.35, compAttack: 0.035, compRelease: 0.16,
    stereoWidth: 1.22, limiterBoost: 3.5, sideHighPassFreq: 110
  },
  rnb: {
    satEnabled: true, satType: 'tape', satDrive: 15, satMix: 12,
    eqLowGain: 2.2, eqLowFreq: 75,
    eqMidGain: -0.8, eqMidFreq: 1000, eqMidQ: 1.0,
    eqHighGain: 0.8, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.35, compAttack: 0.04, compRelease: 0.20,
    stereoWidth: 1.25, limiterBoost: 3.5, sideHighPassFreq: 110
  },
  rock: {
    satEnabled: true, satType: 'tape', satDrive: 22, satMix: 12,
    eqLowGain: 2.0, eqLowFreq: 90,
    eqMidGain: 0.8, eqMidFreq: 2800, eqMidQ: 1.2,
    eqHighGain: 0.6, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.35, compAttack: 0.05, compRelease: 0.15,
    stereoWidth: 1.15, limiterBoost: 4.0, sideHighPassFreq: 110
  },
  metal: {
    satEnabled: true, satType: 'tape', satDrive: 25, satMix: 14,
    eqLowGain: 2.2, eqLowFreq: 85,
    eqMidGain: -1.5, eqMidFreq: 400, eqMidQ: 0.8,
    eqHighGain: 1.2, eqHighFreq: 8500,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.40, compAttack: 0.02, compRelease: 0.10,
    stereoWidth: 1.28, limiterBoost: 4.5, sideHighPassFreq: 120
  },
  edm: {
    satEnabled: true, satType: 'tape', satDrive: 18, satMix: 20,
    eqLowGain: 1.8, eqLowFreq: 90,
    eqMidGain: -0.5, eqMidFreq: 800, eqMidQ: 1.0,
    eqHighGain: 1.0, eqHighFreq: 11000,
    compEnabled: true, compThreshold: -7.0, compRatio: 1.35, compAttack: 0.05, compRelease: 0.20,
    stereoWidth: 1.30, limiterBoost: 4.5, sideHighPassFreq: 150
  },
  hiphop: {
    satEnabled: true, satType: 'tape', satDrive: 15, satMix: 14,
    eqLowGain: 1.8, eqLowFreq: 65,
    eqMidGain: -0.8, eqMidFreq: 350, eqMidQ: 1.0,
    eqHighGain: 0.5, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.40, compAttack: 0.035, compRelease: 0.15,
    stereoWidth: 1.20, limiterBoost: 4.2, sideHighPassFreq: 150
  },
  lofi: {
    satEnabled: true, satType: 'tape', satDrive: 45, satMix: 30,
    eqLowGain: 3.5, eqLowFreq: 150,
    eqMidGain: 0.8, eqMidFreq: 1200, eqMidQ: 1.0,
    eqHighGain: -4.5, eqHighFreq: 7000,
    compEnabled: true, compThreshold: -10.0, compRatio: 1.5, compAttack: 0.06, compRelease: 0.30,
    stereoWidth: 0.92, limiterBoost: 2.8, sideHighPassFreq: 110
  },
  hardcore: {
    satEnabled: true, satType: 'hardcore', satDrive: 28, satMix: 22,
    eqLowGain: 3.0, eqLowFreq: 80,
    eqMidGain: -1.2, eqMidFreq: 800, eqMidQ: 1.0,
    eqHighGain: 1.5, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -8.5, compRatio: 1.45, compAttack: 0.015, compRelease: 0.10,
    stereoWidth: 1.38, limiterBoost: 5.0, sideHighPassFreq: 150
  },
  ambient: {
    satEnabled: true, satType: 'tube', satDrive: 8, satMix: 6,
    eqLowGain: 2.0, eqLowFreq: 80,
    eqMidGain: 0.0, eqMidFreq: 1000, eqMidQ: 0.7,
    eqHighGain: 1.8, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -6.0, compRatio: 1.2, compAttack: 0.12, compRelease: 0.40,
    stereoWidth: 1.55, limiterBoost: 2.0, sideHighPassFreq: 90
  },
  podcast: {
    satEnabled: true, satType: 'tube', satDrive: 5, satMix: 5,
    eqLowGain: -2.0, eqLowFreq: 120,
    eqMidGain: 0.8, eqMidFreq: 1600, eqMidQ: 1.0,
    eqHighGain: 0.2, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -10.0, compRatio: 1.3, compAttack: 0.02, compRelease: 0.15,
    stereoWidth: 1.00, limiterBoost: 2.5, sideHighPassFreq: 150
  },
  classic: {
    satEnabled: false, satType: 'tube', satDrive: 0, satMix: 0,
    eqLowGain: 0.5, eqLowFreq: 100,
    eqMidGain: 0.0, eqMidFreq: 1000, eqMidQ: 0.7,
    eqHighGain: 0.0, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -4.0, compRatio: 1.15, compAttack: 0.15, compRelease: 0.50,
    stereoWidth: 1.30, limiterBoost: 1.5, sideHighPassFreq: 90
  },
  jazz: {
    satEnabled: true, satType: 'tube', satDrive: 10, satMix: 8,
    eqLowGain: 1.2, eqLowFreq: 110,
    eqMidGain: 0.2, eqMidFreq: 1500, eqMidQ: 1.0,
    eqHighGain: 0.4, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.25, compAttack: 0.06, compRelease: 0.25,
    stereoWidth: 1.20, limiterBoost: 2.2, sideHighPassFreq: 90
  },
  acoustic: {
    satEnabled: true, satType: 'tube', satDrive: 8, satMix: 8,
    eqLowGain: 1.0, eqLowFreq: 120,
    eqMidGain: 0.4, eqMidFreq: 2000, eqMidQ: 1.0,
    eqHighGain: 0.8, eqHighFreq: 11000,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.25, compAttack: 0.045, compRelease: 0.22,
    stereoWidth: 1.25, limiterBoost: 2.5, sideHighPassFreq: 90
  }
}

export const GENRE_TARGETS = {
  auto: { low: 2.8, high: 0.10, presence: 0.42 },
  pops: { low: 2.6, high: 0.11, presence: 0.44 },
  rnb: { low: 3.2, high: 0.10, presence: 0.41 },
  rock: { low: 2.9, high: 0.09, presence: 0.43 },
  metal: { low: 3.0, high: 0.11, presence: 0.42 },
  edm: { low: 3.2, high: 0.11, presence: 0.40 },
  hiphop: { low: 3.3, high: 0.09, presence: 0.38 },
  lofi: { low: 3.1, high: 0.06, presence: 0.36 },
  hardcore: { low: 3.2, high: 0.12, presence: 0.42 },
  ambient: { low: 2.9, high: 0.14, presence: 0.44 },
  podcast: { low: 1.6, high: 0.08, presence: 0.47 },
  classic: { low: 2.2, high: 0.08, presence: 0.39 },
  jazz: { low: 2.7, high: 0.09, presence: 0.41 },
  acoustic: { low: 2.4, high: 0.10, presence: 0.43 },
  custom: { low: 2.8, high: 0.10, presence: 0.42 }
}

const LOUDNESS_TARGETS = {
  genre: { boost: null },     // Genre Default (follows selected preset)
  streaming: { boost: 4.0 },  // Standard Streaming -14 LUFS target
  club: { boost: 7.0 },       // Standard Club -9 LUFS target
  loud: { boost: 10.0 },      // Standard Heavy -7 LUFS target
  pure: { boost: 0.0 }        // High Dynamic Range -18 LUFS target
}

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

export function analyzeAudioResonances(buffer, userPresetKey) {
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
  
  const sliceRMSList = [];
  const sliceSpectrums = [];
  
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

      // True peak estimation using L/R channels to prevent input overload on wide stereo tracks
      const absL = Math.abs(l);
      const absR = Math.abs(r);
      if (absL > sliceMax) sliceMax = absL;
      if (absR > sliceMax) sliceMax = absR;
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
    
    // スペクトラム強度の算出と累積（FFTサイズで正規化して正確なdBFSレベルにする）
    const spec = new Float32Array(fftSize / 2);
    const normFactor = fftSize / 2; // Cooley-Tukey FFTの振幅正規化係数 (N/2)
    for (let j = 0; j < fftSize / 2; j++) {
      const mag = Math.sqrt(re[j] * re[j] + im[j] * im[j]) / normFactor;
      avgSpectrum[j] += mag / numSlices;
      spec[j] = mag;
    }
    sliceSpectrums.push(spec);
    sliceRMSList.push(sliceRMS);
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

  // 2. 周波数帯域別エネルギーの集計（音楽音響工学に基づいた4バンド分割）
  // Bass (低域基礎): 20Hz - 160Hz
  // Low-Mids (基音・温かみ・厚み): 160Hz - 800Hz
  // High-Mids (母音・倍音・存在感): 800Hz - 5,000Hz (聴覚感度が最も高いエリア)
  // Treble (空気感・煌びやかさ): 5,000Hz - 20,000Hz
  const binSub = Math.floor((20 * fftSize) / sampleRate);
  const binBassEnd = Math.floor((160 * fftSize) / sampleRate);
  const binMidStart = binBassEnd + 1;
  const binMidEnd = Math.floor((800 * fftSize) / sampleRate);
  const binHighMidStart = binMidEnd + 1;
  const binHighMidEnd = Math.floor((5000 * fftSize) / sampleRate);
  const binAirStart = binHighMidEnd + 1;
  const binAirEnd = Math.min(fftSize / 2 - 1, Math.floor((20000 * fftSize) / sampleRate));

  let bassSum = 0;
  for (let j = binSub; j <= binBassEnd; j++) bassSum += avgSpectrum[j];
  const energyBass = bassSum / (binBassEnd - binSub + 1);

  let lowMidSum = 0;
  for (let j = binMidStart; j <= binMidEnd; j++) lowMidSum += avgSpectrum[j];
  const energyLowMid = lowMidSum / (binMidEnd - binMidStart + 1);

  let highMidSum = 0;
  for (let j = binHighMidStart; j <= binHighMidEnd; j++) highMidSum += avgSpectrum[j];
  const energyHighMid = highMidSum / (binHighMidEnd - binHighMidStart + 1);

  let trebleSum = 0;
  for (let j = binAirStart; j <= binAirEnd; j++) trebleSum += avgSpectrum[j];
  const energyTreble = trebleSum / (binAirEnd - binAirStart + 1);

  // 実際のエネルギー比率 (中低域/ローミッドを基準とする)
  const actualLowMidRatio = energyBass / (energyLowMid + 1e-6);
  const actualHighMidRatio = energyTreble / (energyLowMid + 1e-6);
  const actualPresenceRatio = energyHighMid / (energyLowMid + 1e-6);

  // Noise Floor Estimation in the quietest segment
  let minRmsIdx = 0;
  let minRmsVal = 1.0;
  for (let i = 0; i < sliceRMSList.length; i++) {
    if (sliceRMSList[i] < minRmsVal) {
      minRmsVal = sliceRMSList[i];
      minRmsIdx = i;
    }
  }

  // Hiss estimation (amplitude average between 6kHz and 15kHz in the quietest block)
  const binHissStart = Math.floor((6000 * fftSize) / sampleRate);
  const binHissEnd = Math.floor((15000 * fftSize) / sampleRate);
  let hissSum = 0;
  for (let j = binHissStart; j <= binHissEnd; j++) {
    hissSum += sliceSpectrums[minRmsIdx][j];
  }
  const hissNoiseFloor = hissSum / (binHissEnd - binHissStart + 1);
  const hissNoiseFloorDb = 20 * Math.log10(hissNoiseFloor + 1e-6) + 26.0; // Added FFT bin bandwidth gain correction factor (+26dB) to align bin average with broadband level

  // Rumble estimation (amplitude average between 20Hz and 60Hz in the quietest block)
  const binRumbleStart = Math.floor((20 * fftSize) / sampleRate);
  const binRumbleEnd = Math.floor((60 * fftSize) / sampleRate);
  let rumbleSum = 0;
  for (let j = binRumbleStart; j <= binRumbleEnd; j++) {
    rumbleSum += sliceSpectrums[minRmsIdx][j];
  }
  const rumbleNoiseFloor = rumbleSum / (binRumbleEnd - binRumbleStart + 1);
  const rumbleNoiseFloorDb = 20 * Math.log10(rumbleNoiseFloor + 1e-6) + 26.0; // Added FFT bin bandwidth gain correction factor (+26dB) to align bin average with broadband level

  // Suggested values (ノイズ検出時にのみONにし、ノイズ未検出時は完全にOFFのままにする仕様へ復元)
  let sugRumbleCut = false;
  if (rumbleNoiseFloorDb > -58.0) {
    sugRumbleCut = true;
  }

  let sugHissAmount = 0;
  if (hissNoiseFloorDb > -78.0) { // しきい値を-73dBから-78dBに下げて検出感度を向上
    // -78dB で 0%、-50dB付近で最大 95% になるよう調整（4.5倍スケールでダイナミックに変化）
    const rawHiss = Math.round(Math.max(0, Math.min(95, (hissNoiseFloorDb + 78.0) * 4.5)));
    
    // 静寂区間（最も静かな1秒間）のRMS音量が比較的高い場合、それはヒスではなく楽曲の音である可能性が高いため
    // LPFの過剰カットを防ぐため、Hiss Reducerの適用度を少し抑える安全スケーラー（最小減衰幅を0.70に緩和して感度を維持）
    let quietnessScale = 1.0;
    if (minRmsVal > 0.05) {
      quietnessScale = Math.max(0.70, 1.0 - (minRmsVal - 0.05) / 0.15);
    }
    sugHissAmount = Math.round(rawHiss * quietnessScale);
  }

  // 8連サージカルノッチフィルターはバイパスしますが、サ行のキンキン音（sibilance）を検知して高域EQのブーストを安全クランプするためにスキャンを実行します
  const filteredPeaks = [];
  let sibilanceDynamicFreq = 0;
  
  const sibilanceMinBin = Math.floor((8000 * fftSize) / sampleRate);
  const sibilanceMaxBin = Math.min(fftSize / 2 - 1, Math.floor((11000 * fftSize) / sampleRate));
  const rawSibilancePeaks = [];
  
  for (let j = sibilanceMinBin; j <= sibilanceMaxBin; j++) {
    const val = avgSpectrum[j];
    const peakFreq = Math.round((j * sampleRate) / fftSize);
    if (val > avgSpectrum[j - 1] && val > avgSpectrum[j + 1]) {
      const localBins = [
        avgSpectrum[j - 3], avgSpectrum[j - 2],
        avgSpectrum[j + 2], avgSpectrum[j + 3]
      ];
      const localFloor = localBins.reduce((sum, v) => sum + v, 0) / localBins.length;
      const ratio = val / (localFloor + 1e-9);
      if (ratio > 1.15) {
        rawSibilancePeaks.push({ freq: peakFreq, score: ratio });
      }
    }
  }
  if (rawSibilancePeaks.length > 0) {
    rawSibilancePeaks.sort((a, b) => b.score - a.score);
    sibilanceDynamicFreq = rawSibilancePeaks[0].freq;
  }

  let detectedGenre = 'pops';
  if (actualLowMidRatio > 3.2 && actualHighMidRatio > 0.16 && crestFactorDb < 12.8) {
    detectedGenre = 'edm';
  } else if (actualLowMidRatio > 3.1 && actualHighMidRatio <= 0.16 && crestFactorDb < 12.8) {
    detectedGenre = 'hiphop';
  } else if (actualLowMidRatio >= 1.6 && actualLowMidRatio <= 3.3 && crestFactorDb < 15.5) {
    if (crestFactorDb >= 12.8) {
      if (actualLowMidRatio >= 2.4 && actualLowMidRatio <= 3.1 && avgCorrelation > 0.75 && actualHighMidRatio < 0.12) {
        detectedGenre = 'jazz';
      } else if (actualLowMidRatio < 2.4 && avgCorrelation > 0.75 && actualHighMidRatio < 0.12) {
        detectedGenre = 'acoustic';
      } else {
        detectedGenre = (actualHighMidRatio > 0.14) ? 'metal' : 'rock';
      }
    } else {
      if (actualHighMidRatio >= 0.11) {
        detectedGenre = (actualHighMidRatio > 0.14) ? 'metal' : 'rock';
      } else {
        detectedGenre = 'pops';
      }
    }
  } else if (crestFactorDb >= 13.0) {
    if (actualLowMidRatio < 2.2 && actualHighMidRatio < 0.12) {
      detectedGenre = 'classic';
    } else if (actualHighMidRatio > 0.18 && actualLowMidRatio < 2.8) {
      detectedGenre = 'ambient';
    } else {
      detectedGenre = 'acoustic';
    }
  } else if (actualLowMidRatio < 2.0 && actualHighMidRatio < 0.10) {
    detectedGenre = 'podcast';
  } else {
    detectedGenre = 'pops';
  }

  const genreSelect = document.getElementById('preset-select');
  const userGenreKey = userPresetKey || (genreSelect ? genreSelect.value : 'auto');
  const genreKey = (userGenreKey === 'auto' || userGenreKey === 'custom') ? 'auto' : userGenreKey;
  const basePreset = GENRE_PRESETS[genreKey] || GENRE_PRESETS.auto;

  // EDM, HIPHOP, HARDCORE などの重低音（サブベース）を重視するジャンルの場合、
  // 80Hz以下の帯域を急峻にカットする Rumble Cut はサブベースをごそっと削り取ってしまうため、AI自動解析によるONを禁止します。
  const isSubBassGenre = (detectedGenre === 'edm' || detectedGenre === 'hiphop' || detectedGenre === 'hardcore' ||
                          genreKey === 'edm' || genreKey === 'hiphop' || genreKey === 'hardcore');
  if (isSubBassGenre) {
    sugRumbleCut = false;
  }

  const target = GENRE_TARGETS[genreKey] || GENRE_TARGETS.auto;

  const lowDiffDb = 20 * Math.log10(actualLowMidRatio / target.low);
  const highDiffDb = 20 * Math.log10(actualHighMidRatio / target.high);
  const targetPresence = target.presence || 0.42;
  const presenceDiffDb = 20 * Math.log10(actualPresenceRatio / targetPresence);

  let eqLowAdjustment = 0;
  if (lowDiffDb > 0.5) {
    eqLowAdjustment = -Math.min(3.5, lowDiffDb * 0.75);
  } else if (lowDiffDb < -0.5) {
    eqLowAdjustment = Math.min(2.2, -lowDiffDb * 0.75);
  }
  const eqLowGain = Math.max(-5.0, Math.min(3.0, Math.round((basePreset.eqLowGain + eqLowAdjustment) * 2) / 2));

  let eqMidAdjustment = 0;
  if (presenceDiffDb > 0.5) {
    eqMidAdjustment = -Math.min(1.8, presenceDiffDb * 0.5); // 派手すぎる場合は中域を抑えてマイルドに（最大-1.8dB）
  } else if (presenceDiffDb < -0.5) {
    eqMidAdjustment = Math.min(1.2, -presenceDiffDb * 0.45); // こもっている場合はマイルドに補強（最大+1.2dB）
  }
  const eqMidGain = Math.max(-4.0, Math.min(1.0, Math.round((basePreset.eqMidGain + eqMidAdjustment) * 2) / 2)); // 中音域が強くなりすぎないよう最大値を+1.0dBにクランプ

  let eqHighAdjustment = 0;
  if (highDiffDb > 0.5) {
    eqHighAdjustment = -Math.min(2.0, highDiffDb * 0.5); // 派手すぎる場合はマイルドに減衰（最大-2.0dB）
  } else if (highDiffDb < -0.5) {
    eqHighAdjustment = Math.min(1.5, -highDiffDb * 0.45); // 不足している場合はマイルドに補強（最大+1.5dB）
  }

  let eqHighGain = Math.max(-5.0, Math.min(1.2, Math.round((basePreset.eqHighGain + eqHighAdjustment) * 2) / 2)); // キンキンしすぎないよう最大ブースト量を+1.2dBに制限

  // キンキン共鳴音 (sibilanceDynamicFreq > 0) が検知されている場合、高域EQのブーストを禁止し、安全のために少なくとも-1.5dB以下の減衰量にクランプ
  if (sibilanceDynamicFreq > 0) {
    eqHighGain = Math.min(-1.5, eqHighGain);
  }

  // 現在選択されているラウドネス・ターゲットの取得と基準ブースト値の設定
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

  // ダイナミクス補正 (音楽理論・ダイナミックレンジ基準によるクレストファクター分析)
  let compThreshold = basePreset.compThreshold;
  let compRatio = basePreset.compRatio;
  let limiterBoost = baseBoost;
  let crestDesc = "Normal (Balanced)";

  // ジャンル別理想ターゲット・クレストファクター（強弱の幅）
  const genreTargetCrest = {
    auto: 10.5,     // AI AUTO: リファレンス中立（適正ダイナミクス）
    pops: 11.0,     // POPS: 標準的なポップス
    rnb: 10.0,      // R&B: 低域圧縮とグルーヴ
    rock: 11.0,     // ROCK: 生ドラムのパンチ感を残す
    metal: 9.5,     // METAL: 音圧の壁とタイトさ
    edm: 8.5,       // EDM: クラブ向けの均一で高い音圧
    hiphop: 9.0,    // HIPHOP: キックの抜けとアタック重視
    lofi: 12.0,     // LOFI: 生音の暖かみ・広がり
    hardcore: 7.5,  // HARDCORE: 最大限の押し込み
    ambient: 13.5,  // AMBIENT: 広い強弱と空気感
    podcast: 10.5,  // PODCAST: 会話の聞き取りやすさ優先
    classic: 14.5,  // CLASSIC: 生楽器のダイナミクスを最大限活かす
    jazz: 12.5,     // JAZZ: アコースティックなニュアンス
    acoustic: 13.0, // ACOUSTIC: ピッキング等の生々しさ
    custom: 10.5
  };
  const targetCrest = genreTargetCrest[genreKey] || genreTargetCrest.auto;

  const crestDiff = crestFactorDb - targetCrest;
  if (crestDiff > 0.0) {
    // 音源がターゲットよりもダイナミック（強弱が広い） -> コンプレッサーのしきい値を下げ、リミッターのブースト量を増やして適正レベルに収束させる
    const compressionFactor = Math.min(6.0, crestDiff * 0.4); // 最大-6dBしきい値を下げる
    const ratioFactor = Math.min(0.2, crestDiff * 0.05);     // 圧縮比もマイルドに加算
    compThreshold = Math.max(-14.0, basePreset.compThreshold - compressionFactor);
    compRatio = Math.min(1.6, basePreset.compRatio + ratioFactor);
    crestDesc = "High (Highly Dynamic)";
    
    // リミッターを適正にドライブして音圧を出す (過剰な音圧を防ぐためbonusを最大+1.8dBに制限)
    const bonus = Math.min(1.8, crestDiff * 0.4);
    limiterBoost = baseBoost + bonus;
  } else {
    // 音源がすでに強く圧縮されている -> 二重圧縮での音割れを防ぐため、コンプレッサーを逃がし（浅くし）、ブーストも下げる
    const releaseFactor = Math.min(4.0, -crestDiff * 0.5);
    const ratioFactor = Math.min(0.2, -crestDiff * 0.05);
    compThreshold = Math.min(-5.0, basePreset.compThreshold + releaseFactor);
    compRatio = Math.max(1.15, basePreset.compRatio - ratioFactor);
    crestDesc = "Low (Highly Compressed)";
    
    const penalty = Math.min(4.0, -crestDiff * 0.8);
    limiterBoost = Math.max(1.0, baseBoost - penalty);
  }

  // 低域飽和による音割れ・ビビリ防止（低域が基準ターゲットより著しく大きい場合、リミッターブーストを自動で控えめにする）
  if (lowDiffDb > 1.0) {
    const bassOverloadPenalty = Math.min(1.5, (lowDiffDb - 1.0) * 0.75);
    limiterBoost = Math.max(2.0, limiterBoost - bassOverloadPenalty);
  }

  // 0.0〜8.0dB の範囲に制限し（耳を保護するため最大値を8.0dBに抑制）、小数点第一位に丸める
  limiterBoost = Math.max(0.0, Math.min(8.0, Math.round(limiterBoost * 10) / 10));

  // ステレオ幅の補正 (位相相関に基づいた連続的スケーリング)
  let stereoWidth = basePreset.stereoWidth;
  let corrDesc = "Balanced";
  
  if (avgCorrelation > 0.82) {
    // 位相がほぼセンターに集まっている（モノラルに近い）-> 音源の広がり不足に応じて自動拡張
    const expansion = Math.min(0.25, (avgCorrelation - 0.82) * 1.5);
    stereoWidth = Math.min(1.4, basePreset.stereoWidth + expansion);
    corrDesc = "Mono-leaning (Expanded)";
  } else if (avgCorrelation < 0.72) {
    // ライブ音源やリバーブで既に左右に広がりすぎている -> コムフィルターや歪みを防ぐため、1.0（等倍）以下にクランプする
    const reduction = Math.min(0.2, (0.72 - avgCorrelation) * 0.8);
    stereoWidth = Math.max(0.85, Math.min(1.0, basePreset.stereoWidth - 0.2 - reduction));
    corrDesc = "Wide/Phasey (Clamped)";
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

  // High Shelf Frequency Dynamic Calculation
  const bin4k = Math.floor((4000 * fftSize) / sampleRate);
  const bin9k = Math.floor((9000 * fftSize) / sampleRate);
  const bin18k = Math.floor((18000 * fftSize) / sampleRate);

  let brillianceSum = 0;
  for (let j = bin4k; j <= bin9k; j++) brillianceSum += avgSpectrum[j];
  const brillianceEnergy = brillianceSum / (bin9k - bin4k + 1);

  let airSum = 0;
  for (let j = bin9k + 1; j <= bin18k; j++) airSum += avgSpectrum[j];
  const airEnergy = airSum / (bin18k - bin9k);

  const airToBrillianceRatio = airEnergy / (brillianceEnergy + 1e-6);

  let suggestedEqHighFreq = basePreset.eqHighFreq;

  if (actualHighMidRatio < 0.10) {
    // High-mids are extremely dull overall -> Pull down the shelf to boost from 8.0kHz
    suggestedEqHighFreq = 8000;
  } else if (airToBrillianceRatio < 0.16) {
    // Air drops off sharply compared to mid-highs -> Target the transition around 9.5kHz
    suggestedEqHighFreq = 9500;
  } else if (airToBrillianceRatio > 0.32) {
    // Air is already present, but could use air-band finish -> Target 12kHz
    suggestedEqHighFreq = 12000;
  } else {
    // Normal balanced spectrum -> Target standard 10kHz or preset default
    suggestedEqHighFreq = Math.round((basePreset.eqHighFreq || 10000) / 500) * 500;
  }

  // Clamp within safe high shelf ranges (7,500Hz to 13,000Hz)
  suggestedEqHighFreq = Math.max(7500, Math.min(13000, suggestedEqHighFreq));

  // 4. Stereo Bass phase cancellation safeguard (ビビリ音・歪み防止)
  let finalEqLowGain = eqLowGain;
  let finalLimiterBoost = limiterBoost;
  let finalSideHPF = basePreset.sideHighPassFreq || 110;
  
  if (avgCorrelation < 0.72) {
    // 左右の位相ズレが大きい（広いL/R Bass / 深いリバーブ等）場合、
    // モノラル加算時の相関キャンセリングによるAI過剰EQブーストと、L/R個別ピークのソフトクリッパー限界突破（ビビリ音）を防ぐための補正
    
    // 1. 低域EQブーストを厳格に制限（位相ズレがある場合は低域ブースト上限を最大+1.0dB、深刻な場合は+0.0dBに固定）
    const maxLowBoost = avgCorrelation < 0.60 ? 0.0 : 1.0;
    finalEqLowGain = Math.min(maxLowBoost, finalEqLowGain);
    
    // 2. マキシマイザーの押し込み量（Limiter Boost）に位相相関ペナルティを適用
    const phasePenalty = (0.75 - avgCorrelation) * 4.0; // ズレが大きいほどマキシマイザーを緩和（最大2.0dB以上引き下げ）
    finalLimiterBoost = Math.max(1.5, finalLimiterBoost - phasePenalty);
    
    // 3. Sideチャンネルのハイパス周波数を引き上げ（低域をセンターモノラルに集約し、L/R独立クリップを根本防止）
    finalSideHPF = Math.max(160, finalSideHPF);
  }
  
  finalLimiterBoost = Math.round(finalLimiterBoost * 10) / 10;

  // 動的なディエッサー強度の算出
  let suggestedDeesserAmount = 40; // デフォルトで基本有効（40%）
  if (sibilanceDynamicFreq > 0 && rawSibilancePeaks.length > 0) {
    const maxScore = rawSibilancePeaks[0].score;
    suggestedDeesserAmount = Math.round(Math.min(85, Math.max(40, 40 + (maxScore - 1.15) * 60)));
  }

  return {
    detected: filteredPeaks.length > 0,
    notches: filteredPeaks,
    crestFactor: crestFactorDb,
    crestDesc: crestDesc,
    correlation: avgCorrelation,
    correlationDesc: corrDesc,
    bassDiff: lowDiffDb,
    trebleDiff: highDiffDb,
    rumbleNoiseFloorDb: rumbleNoiseFloorDb,
    hissNoiseFloorDb: hissNoiseFloorDb,
    baseLoudnessDesc: baseLoudnessDesc,
    detectedGenre: detectedGenre,
    suggestedParams: {
      inputGainDb: Math.round(suggestedInputGainDb * 10) / 10,
      satEnabled: basePreset.satEnabled,
      satType: basePreset.satType,
      satDrive: satDrive,
      satMix: satMix,
      eqLowGain: finalEqLowGain,
      eqLowFreq: basePreset.eqLowFreq,
      eqMidGain: eqMidGain,
      eqMidFreq: basePreset.eqMidFreq,
      eqMidQ: basePreset.eqMidQ || 1.0,
      eqHighGain: eqHighGain,
      eqHighFreq: suggestedEqHighFreq,
      compEnabled: basePreset.compEnabled,
      compThreshold: compThreshold,
      compRatio: compRatio,
      compAttack: basePreset.compAttack,
      compRelease: basePreset.compRelease,
      stereoWidth: stereoWidth,
      sideHighPassFreq: finalSideHPF,
      limiterBoost: finalLimiterBoost,
      rumbleCutEnabled: sugRumbleCut,
      hissReductionAmount: sugHissAmount,
      sibilanceDynamicFreq: sibilanceDynamicFreq,
      deesserAmount: suggestedDeesserAmount
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
      ceiling: -1.0,
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
      hissReductionAmount: 0,
      kickPeakingGain: 0.0
    }, []);
  }

  _buildChain() {
    const context = this.ctx;

    // 1. Input Gain node
    this.inputGainNode = context.createGain();
    this.inputGainNode.gain.setValueAtTime(1.0, context.currentTime);

    // 2. Rumble Filter (HPF)
    this.rumbleFilter = context.createBiquadFilter();
    this.rumbleFilter.type = 'highpass';
    this.rumbleFilter.frequency.setValueAtTime(18.0, context.currentTime); // 18Hz subsonic filter when disabled, protecting deep sub-bass while removing DC offset/infrasound mud.
    this.rumbleFilter.Q.setValueAtTime(0.707, context.currentTime);

    // 3. Dynamic Hiss Filter (VCF Lowpass)
    this.hissFilter = context.createBiquadFilter();
    this.hissFilter.type = 'lowpass';
    this.hissFilter.frequency.setValueAtTime(20000.0, context.currentTime);
    this.hissFilter.Q.setValueAtTime(0.5, context.currentTime); // Gentle slope

    // 3b. Sidechain Envelope Follower for Hiss Filter
    this.sidechainHpf = context.createBiquadFilter();
    this.sidechainHpf.type = 'highpass';
    this.sidechainHpf.frequency.setValueAtTime(2000.0, context.currentTime); // Lowered to 2,000Hz to detect vocal/midrange energy and open the filter.
    this.sidechainHpf.Q.setValueAtTime(0.707, context.currentTime);

    this.sidechainGainNode = context.createGain();
    this.sidechainGainNode.gain.setValueAtTime(10.0, context.currentTime); // Boost sidechain energy to generate robust envelope values during active music

    this.rectifier = context.createWaveShaper();
    this.rectifier.curve = this._generateAbsoluteValCurve();

    this.envelopeSmoother = context.createBiquadFilter();
    this.envelopeSmoother.type = 'lowpass';
    this.envelopeSmoother.frequency.setValueAtTime(2.0, context.currentTime); // Slowed down from 10Hz to 2Hz to smooth out dynamic filter sweeps and eliminate swirling/phasing artifacts on reverb tails and cheers.
    this.envelopeSmoother.Q.setValueAtTime(0.707, context.currentTime);

    this.hissEnvelopeGain = context.createGain();
    this.hissEnvelopeGain.gain.setValueAtTime(0.0, context.currentTime);

    // Hiss sidechain connections
    this.rumbleFilter.connect(this.sidechainHpf);
    this.sidechainHpf.connect(this.sidechainGainNode);
    this.sidechainGainNode.connect(this.rectifier);
    this.rectifier.connect(this.envelopeSmoother);
    this.envelopeSmoother.connect(this.hissEnvelopeGain);
    this.hissEnvelopeGain.connect(this.hissFilter.frequency);

    // 4. Parallel Saturator Stage
    this.satDryGain = context.createGain();
    this.satWetGain = context.createGain();
    this.waveShaper = context.createWaveShaper();
    this.satSumNode = context.createGain();

    // High-pass filter for Saturator Wet path to prevent low-end intermodulation mud (ボワボワ)
    this.satHpf = context.createBiquadFilter();
    this.satHpf.type = 'highpass';
    this.satHpf.frequency.setValueAtTime(150.0, context.currentTime); // Cut sub-bass/bass saturation
    this.satHpf.Q.setValueAtTime(0.707, context.currentTime);

    this.waveShaper.curve = this._generateSaturatorCurve('tape', 10.0);
    this.waveShaper.oversample = 'none'; // フィルター遅延による位相干渉（コームフィルター）を防ぐため、オーバーサンプリングを無効化します。

    // Hook up main signal path
    this.inputNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.rumbleFilter);
    this.rumbleFilter.connect(this.hissFilter);

    this.hissFilter.connect(this.satDryGain);
    this.hissFilter.connect(this.satHpf);
    this.satHpf.connect(this.waveShaper); // Feed highpassed signal to waveshaper to keep low end clean
    this.waveShaper.connect(this.satWetGain);

    this.satDryGain.connect(this.satSumNode);
    this.satWetGain.connect(this.satSumNode);

    // 5. 3-Band Equalizer (Low Shelf, Mid Peaking, High Shelf)
    this.eqLow = context.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.setValueAtTime(120.0, context.currentTime);

    // Dedicated Peaking Filter for Kick Punch (v3.30+)
    this.kickPeaking = context.createBiquadFilter();
    this.kickPeaking.type = 'peaking';
    this.kickPeaking.Q.setValueAtTime(2.0, context.currentTime); // narrow Q to isolate kick drum
    this.kickPeaking.frequency.setValueAtTime(55.0, context.currentTime); // 55Hz fundamental thump

    this.eqMid = context.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.Q.setValueAtTime(1.0, context.currentTime);
    this.eqMid.frequency.setValueAtTime(1000.0, context.currentTime);

    this.eqHigh = context.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.setValueAtTime(10000.0, context.currentTime);

    // Dedicated Dynamic Sibilance Notch (9000Hz De-esser)
    this.sibilanceNotch = context.createBiquadFilter();
    this.sibilanceNotch.type = 'peaking';
    this.sibilanceNotch.frequency.setValueAtTime(9000.0, context.currentTime);
    this.sibilanceNotch.Q.setValueAtTime(5.0, context.currentTime); // surgical Q targeting sibilance peak
    this.sibilanceNotch.gain.setValueAtTime(0.0, context.currentTime); // default neutral

    this.sibilanceNotchDynamicGain = context.createGain();
    this.sibilanceNotchDynamicGain.gain.setValueAtTime(0.0, context.currentTime);
    this.envelopeSmoother.connect(this.sibilanceNotchDynamicGain);
    this.sibilanceNotchDynamicGain.connect(this.sibilanceNotch.gain);

    // 6. Corrective Notch Filters (8-band cascade)
    for (let i = 1; i <= 8; i++) {
      this[`eqCorrective${i}`] = context.createBiquadFilter();
      this[`eqCorrective${i}`].type = 'peaking';
      this[`eqCorrective${i}`].frequency.setValueAtTime(1000.0, context.currentTime);
      this[`eqCorrective${i}`].gain.setValueAtTime(0.0, context.currentTime);
      this[`eqCorrective${i}`].Q.setValueAtTime(18.0, context.currentTime);
    }

    // 7. Dynamics Compressor
    this.compressor = context.createDynamicsCompressor();
    this.compressor.knee.setValueAtTime(6.0, context.currentTime);
    this.compressor.threshold.setValueAtTime(-15.0, context.currentTime);
    this.compressor.ratio.setValueAtTime(1.6, context.currentTime);
    this.compressor.attack.setValueAtTime(0.03, context.currentTime);
    this.compressor.release.setValueAtTime(0.15, context.currentTime);

    this.satSumNode.connect(this.eqLow);
    this.eqLow.connect(this.kickPeaking);
    this.kickPeaking.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.sibilanceNotch);
    // Connect eqHigh to sibilanceNotch, then to compressor, keeping the dynamic de-esser active while bypassing the 8x surgical notches
    this.sibilanceNotch.connect(this.compressor);

    // 8. Stereo Imager Matrix (Mid/Side Processing)
    this.splitter = context.createChannelSplitter(2);
    this.midSum = context.createGain();
    this.sideDiff = context.createGain();

    this.leftToMid = context.createGain(); this.leftToMid.gain.setValueAtTime(0.5, context.currentTime);
    this.rightToMid = context.createGain(); this.rightToMid.gain.setValueAtTime(0.5, context.currentTime);
    this.leftToSide = context.createGain(); this.leftToSide.gain.setValueAtTime(0.5, context.currentTime);
    this.rightToSide = context.createGain(); this.rightToSide.gain.setValueAtTime(-0.5, context.currentTime);

    this.compressor.connect(this.splitter);

    // Map L/R to Mid-Side
    this.splitter.connect(this.leftToMid, 0); // L
    this.splitter.connect(this.rightToMid, 1); // R
    this.leftToMid.connect(this.midSum);
    this.rightToMid.connect(this.midSum);

    this.splitter.connect(this.leftToSide, 0); // L
    this.splitter.connect(this.rightToSide, 1); // R
    this.leftToSide.connect(this.sideDiff);
    this.rightToSide.connect(this.sideDiff);

    // Stereo Width Gain Nodes
    this.midGain = context.createGain();
    this.sideGain = context.createGain();

    this.sideHighPass = context.createBiquadFilter();
    this.sideHighPass.type = 'highpass';
    this.sideHighPass.frequency.setValueAtTime(110.0, context.currentTime);
    this.sideHighPass.Q.setValueAtTime(0.707, context.currentTime);

    this.midGain.gain.setValueAtTime(1.0, context.currentTime);
    this.sideGain.gain.setValueAtTime(1.0, context.currentTime);

    this.midSum.connect(this.midGain);

    // Side signals go through highpass then width gain
    this.sideDiff.connect(this.sideHighPass);
    this.sideHighPass.connect(this.sideGain);

    // Decode back to Stereo L/R
    this.leftSum = context.createGain();
    this.rightDiff = context.createGain();
    this.sideInverter = context.createGain();
    this.sideInverter.gain.setValueAtTime(-1.0, context.currentTime);

    this.midGain.connect(this.leftSum);
    this.sideGain.connect(this.leftSum); // L = Mid + Side

    this.midGain.connect(this.rightDiff);
    this.sideGain.connect(this.sideInverter);
    this.sideInverter.connect(this.rightDiff); // R = Mid - Side

    this.merger = context.createChannelMerger(2);
    this.leftSum.connect(this.merger, 0, 0);
    this.rightDiff.connect(this.merger, 0, 1);

    // 9. Maximizer & Limiter (Near-instant 0.1ms attack, 80ms release)
    this.limiterGain = context.createGain();
    this.limiterGain.gain.setValueAtTime(1.0, context.currentTime);

    this.merger.connect(this.limiterGain);

    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-3.0, context.currentTime); // -3.0dB threshold provides look-ahead emulation cushion
    this.limiter.knee.setValueAtTime(3.0, context.currentTime);      // Smooth knee
    this.limiter.ratio.setValueAtTime(20.0, context.currentTime);    // Dynamic limiting brickwall
    this.limiter.attack.setValueAtTime(0.0001, context.currentTime); // 0.1ms (near-instant reaction to catch peaks)
    this.limiter.release.setValueAtTime(0.08, context.currentTime);  // 80ms (optimized to prevent low-end distortion)

    // 9b. Safety Soft Clipper (WaveShaper Node)
    this.safetyClipper = context.createWaveShaper();
    this.safetyClipper.curve = this._generateSoftClipCurve();
    this.safetyClipper.oversample = '2x'; // 2x oversampling to prevent aliasing

    this.limiterGain.connect(this.limiter);
    this.limiter.connect(this.safetyClipper);

    // 10. Output ceiling gain
    this.ceilingGain = context.createGain();
    this.ceilingGain.gain.setValueAtTime(Math.pow(10, -1.0 / 20), context.currentTime);

    this.safetyClipper.connect(this.ceilingGain);
  }

  setMasteringParams(params, notches) {
    const t = this.ctx.currentTime;

    // 1. Input Gain stage
    const inputGain = Math.pow(10, (params.inputGainDb || 0.0) / 20.0);
    this.inputGainNode.gain.setTargetAtTime(inputGain, t, 0.05);

    // 1b. Output Ceiling
    const ceilingGain = Math.pow(10, (params.ceiling || -1.0) / 20.0);
    this.ceilingGain.gain.setTargetAtTime(ceilingGain, t, 0.05);

    // 2. Rumble Filter (80Hz when active, 18Hz subsonic cut when bypassed)
    if (params.rumbleCutEnabled) {
      this.rumbleFilter.frequency.setTargetAtTime(80.0, t, 0.05);
    } else {
      this.rumbleFilter.frequency.setTargetAtTime(18.0, t, 0.05);
    }

    // 3. Hiss Reduction
    const hissAmount = params.hissReductionAmount || 0;
    // 高域の抜け（空気感）を潰さないよう、ローパスの遮断周波数の下限を13,000Hz付近に留めるマイルド設計に調整（100%設定時でも13,000Hzを維持し、音が曇るのを防止）
    const baseFreq = 20000.0 - (7000.0 * (hissAmount / 100.0));
    this.hissFilter.frequency.setTargetAtTime(baseFreq, t, 0.05);
    
    // 高域ヒスノイズ（13kHz〜20kHz）が楽曲再生中も完全に消え去るよう、上限遮断周波数（天井）を制限
    // 高域ヒスノイズ（超高域成分）をマイルドに抑制する天井周波数（最大でも15,000Hz以下には下げない）
    const ceilFreq = 20000.0 - (5000.0 * (hissAmount / 100.0));
    const maxEnvGain = Math.max(0, ceilFreq - baseFreq);
    this.hissEnvelopeGain.gain.setTargetAtTime(maxEnvGain, t, 0.05);

    // 4. Parallel Saturation
    const blend = params.satEnabled ? (params.satMix / 100.0) : 0.0;
    this.satDryGain.gain.setTargetAtTime(1.0 - blend, t, 0.05);
    this.satWetGain.gain.setTargetAtTime(blend, t, 0.05);
    this.waveShaper.curve = this._generateSaturatorCurve(params.satType, params.satDrive);

    // 5. 3-band EQ + kick Peaking
    this.eqLow.frequency.setTargetAtTime(params.eqLowFreq || 120.0, t, 0.05);
    this.eqLow.gain.setTargetAtTime(params.eqLowGain, t, 0.05);
    this.kickPeaking.gain.setTargetAtTime(params.kickPeakingGain || 0.0, t, 0.05);
    
    this.eqMid.frequency.setTargetAtTime(params.eqMidFreq || 1000.0, t, 0.05);
    this.eqMid.gain.setTargetAtTime(params.eqMidGain, t, 0.05);
    this.eqMid.Q.setTargetAtTime(params.eqMidQ || 1.0, t, 0.05);

    this.eqHigh.frequency.setTargetAtTime(params.eqHighFreq || 10000.0, t, 0.05);
    this.eqHigh.gain.setTargetAtTime(params.eqHighGain, t, 0.05);

    // Decoupled from hissAmount: always active at -6.0dB max if sibilance is detected
    if (this.sibilanceNotch && this.sibilanceNotchDynamicGain) {
      const isSibilant = (params.sibilanceDynamicFreq && params.sibilanceDynamicFreq > 0);
      const dynamicCut = isSibilant ? -6.0 : 0.0;
      this.sibilanceNotch.frequency.setTargetAtTime(params.sibilanceDynamicFreq || 9000, t, 0.05);
      this.sibilanceNotchDynamicGain.gain.setTargetAtTime(dynamicCut, t, 0.05);
    }

    // 6. Corrective Notch Filters
    this.setCorrectiveNotches(notches, hissAmount);

    // 7. Glue Compressor
    if (params.compEnabled) {
      this.compressor.threshold.setTargetAtTime(params.compThreshold, t, 0.05);
      this.compressor.ratio.setTargetAtTime(params.compRatio, t, 0.05);
      if (params.compAttack) this.compressor.attack.setTargetAtTime(params.compAttack, t, 0.05);
      if (params.compRelease) this.compressor.release.setTargetAtTime(params.compRelease, t, 0.05);
    } else {
      this.compressor.threshold.setTargetAtTime(0.0, t, 0.05);
      this.compressor.ratio.setTargetAtTime(1.0, t, 0.05);
    }

    // 8. Stereo Width
    this.sideGain.gain.setTargetAtTime(params.stereoWidth, t, 0.05);
    if (params.sideHighPassFreq) {
      this.sideHighPass.frequency.setTargetAtTime(params.sideHighPassFreq, t, 0.05);
    }

    // 9. Maximizer Gain
    const linearBoost = Math.pow(10, (params.limiterBoost || 0.0) / 20.0);
    this.limiterGain.gain.setTargetAtTime(linearBoost, t, 0.05);
  }

  setCorrectiveNotches(notches, hissAmount = 0) {
    const t = this.ctx.currentTime;
    const setupHissFactor = 1.0; // Keep surgical notches at full depth for uncompromised resonance removal

    for (let i = 0; i < 8; i++) {
      const filter = this[`eqCorrective${i+1}`];
      if (notches && notches[i]) {
        filter.frequency.setTargetAtTime(notches[i].freq, t, 0.05);
        filter.gain.setTargetAtTime(notches[i].cut * setupHissFactor, t, 0.05);
        filter.Q.setTargetAtTime(notches[i].q || 15.0, t, 0.05);
      } else {
        filter.gain.setTargetAtTime(0.0, t, 0.05);
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
    const threshold = 0.96; // Linear up to 0.96 amplitude (~ -0.35 dBFS) to prevent low-end intermodulation distortion
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
    } else if (type === 'hardcore') {
      const k = 1.0 + (drive / 100) * 14.0;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        const val = x * k;
        curve[i] = Math.max(-0.82, Math.min(0.82, val));
      }
    } else {
      for (let i = 0; i < n_samples; ++i) {
        curve[i] = (i * 2) / n_samples - 1;
      }
    }
    return curve;
  }
}