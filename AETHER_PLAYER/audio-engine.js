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
    eqMidGain: 1.2, eqMidFreq: 1800, eqMidQ: 1.0,
    eqHighGain: 2.2, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.35, compAttack: 0.035, compRelease: 0.16,
    stereoWidth: 1.22, limiterBoost: 4.2, sideHighPassFreq: 110
  },
  rnb: {
    satEnabled: true, satType: 'tape', satDrive: 15, satMix: 12,
    eqLowGain: 2.2, eqLowFreq: 75,
    eqMidGain: -0.8, eqMidFreq: 1000, eqMidQ: 1.0,
    eqHighGain: 2.0, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.35, compAttack: 0.04, compRelease: 0.20,
    stereoWidth: 1.25, limiterBoost: 4.2, sideHighPassFreq: 110
  },
  rock: {
    satEnabled: true, satType: 'tape', satDrive: 22, satMix: 12,
    eqLowGain: 2.0, eqLowFreq: 90,
    eqMidGain: 1.5, eqMidFreq: 2800, eqMidQ: 1.2,
    eqHighGain: 1.5, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.35, compAttack: 0.05, compRelease: 0.15,
    stereoWidth: 1.15, limiterBoost: 4.8, sideHighPassFreq: 110
  },
  metal: {
    satEnabled: true, satType: 'tape', satDrive: 25, satMix: 14,
    eqLowGain: 2.2, eqLowFreq: 85,
    eqMidGain: -1.8, eqMidFreq: 400, eqMidQ: 0.8,
    eqHighGain: 2.5, eqHighFreq: 8500,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.40, compAttack: 0.02, compRelease: 0.10,
    stereoWidth: 1.28, limiterBoost: 5.2, sideHighPassFreq: 120
  },
  edm: {
    satEnabled: true, satType: 'tape', satDrive: 18, satMix: 20,
    eqLowGain: 1.8, eqLowFreq: 90,
    eqMidGain: -0.5, eqMidFreq: 800, eqMidQ: 1.0,
    eqHighGain: 2.0, eqHighFreq: 11000,
    compEnabled: true, compThreshold: -8.5, compRatio: 1.45, compAttack: 0.02, compRelease: 0.12,
    stereoWidth: 1.30, limiterBoost: 5.5, sideHighPassFreq: 150
  },
  hiphop: {
    satEnabled: true, satType: 'tape', satDrive: 15, satMix: 14,
    eqLowGain: 1.8, eqLowFreq: 65,
    eqMidGain: -0.8, eqMidFreq: 350, eqMidQ: 1.0,
    eqHighGain: 1.2, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -8.0, compRatio: 1.40, compAttack: 0.035, compRelease: 0.15,
    stereoWidth: 1.20, limiterBoost: 4.8, sideHighPassFreq: 150
  },
  lofi: {
    satEnabled: true, satType: 'tape', satDrive: 45, satMix: 30,
    eqLowGain: 3.5, eqLowFreq: 150,
    eqMidGain: 1.5, eqMidFreq: 1200, eqMidQ: 1.0,
    eqHighGain: -4.5, eqHighFreq: 7000,
    compEnabled: true, compThreshold: -10.0, compRatio: 1.5, compAttack: 0.06, compRelease: 0.30,
    stereoWidth: 0.92, limiterBoost: 3.2, sideHighPassFreq: 110
  },
  hardcore: {
    satEnabled: true, satType: 'hardcore', satDrive: 28, satMix: 22,
    eqLowGain: 3.0, eqLowFreq: 80,
    eqMidGain: -1.2, eqMidFreq: 800, eqMidQ: 1.0,
    eqHighGain: 3.0, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -8.5, compRatio: 1.45, compAttack: 0.015, compRelease: 0.10,
    stereoWidth: 1.38, limiterBoost: 6.0, sideHighPassFreq: 150
  },
  ambient: {
    satEnabled: true, satType: 'tube', satDrive: 8, satMix: 6,
    eqLowGain: 2.0, eqLowFreq: 80,
    eqMidGain: 0.0, eqMidFreq: 1000, eqMidQ: 0.7,
    eqHighGain: 3.0, eqHighFreq: 12000,
    compEnabled: true, compThreshold: -6.0, compRatio: 1.2, compAttack: 0.12, compRelease: 0.40,
    stereoWidth: 1.55, limiterBoost: 2.2, sideHighPassFreq: 90
  },
  podcast: {
    satEnabled: true, satType: 'tube', satDrive: 5, satMix: 5,
    eqLowGain: -2.0, eqLowFreq: 120,
    eqMidGain: 1.2, eqMidFreq: 1600, eqMidQ: 1.0,
    eqHighGain: 0.8, eqHighFreq: 8000,
    compEnabled: true, compThreshold: -10.0, compRatio: 1.3, compAttack: 0.02, compRelease: 0.15,
    stereoWidth: 1.00, limiterBoost: 3.0, sideHighPassFreq: 150
  },
  classic: {
    satEnabled: false, satType: 'tube', satDrive: 0, satMix: 0,
    eqLowGain: 0.5, eqLowFreq: 100,
    eqMidGain: 0.0, eqMidFreq: 1000, eqMidQ: 0.7,
    eqHighGain: 0.5, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -4.0, compRatio: 1.15, compAttack: 0.15, compRelease: 0.50,
    stereoWidth: 1.30, limiterBoost: 1.8, sideHighPassFreq: 90
  },
  jazz: {
    satEnabled: true, satType: 'tube', satDrive: 10, satMix: 8,
    eqLowGain: 1.2, eqLowFreq: 110,
    eqMidGain: 0.5, eqMidFreq: 1500, eqMidQ: 1.0,
    eqHighGain: 1.0, eqHighFreq: 10000,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.25, compAttack: 0.06, compRelease: 0.25,
    stereoWidth: 1.20, limiterBoost: 2.8, sideHighPassFreq: 90
  },
  acoustic: {
    satEnabled: true, satType: 'tube', satDrive: 8, satMix: 8,
    eqLowGain: 1.0, eqLowFreq: 120,
    eqMidGain: 0.8, eqMidFreq: 2000, eqMidQ: 1.0,
    eqHighGain: 1.8, eqHighFreq: 11000,
    compEnabled: true, compThreshold: -7.5, compRatio: 1.25, compAttack: 0.045, compRelease: 0.22,
    stereoWidth: 1.25, limiterBoost: 3.0, sideHighPassFreq: 90
  }
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
  const rumbleNoiseFloorDb = 20 * Math.log10(rumbleNoiseFloor + 1e-6);

  // Suggested values (ノイズ検出時にのみONにし、ノイズ未検出時は完全にOFFのままにする仕様へ復元)
  let sugRumbleCut = false;
  if (rumbleNoiseFloorDb > -58.0) {
    sugRumbleCut = true;
  }

  let sugHissAmount = 0;
  if (hissNoiseFloorDb > -68.0) { // -62dB から -68dB へ緩やかに感度を引き下げ、ヘッドホンで聴こえるノイズ成分を自動検出
    // -68dB で 0%、-40dB で最大 90% になるよう比率を調整（3.2倍スケール）
    const rawHiss = Math.round(Math.max(0, Math.min(90, (hissNoiseFloorDb + 68.0) * 3.2)));
    
    // 静寂区間（最も静かな1秒間）のRMS音量が比較的高い場合、それはヒスではなく楽曲の音（シンセパッドやエフェクトの残響等）である可能性が高いため
    // LPFの過剰カットを防ぐため、Hiss Reducerの適用度を減衰する安全スケーラー
    let quietnessScale = 1.0;
    if (minRmsVal > 0.03) {
      // 最低RMSが 0.03（約-30dBFS）〜0.12（約-18dBFS）の間で、スケール値を 1.0 から 0.35 まで滑らかに減衰（完全に0%になるのを防ぎ、マイルドなノイズ除去を最低限残す）
      quietnessScale = Math.max(0.35, 1.0 - (minRmsVal - 0.03) / 0.09);
    }
    sugHissAmount = Math.round(rawHiss * quietnessScale);
  }

  // 3. 耳障りな高音域（シャリシャリした sibilance 帯域：7.0kHz 〜 20kHz）のマルチピーク走査（上限撤廃）
  const sibilanceMinBin = Math.floor((7000 * fftSize) / sampleRate);
  const sibilanceMaxBin = Math.min(fftSize / 2 - 1, Math.floor((20000 * fftSize) / sampleRate));
  
  // ローカルピーク（極大値かつ周辺のローカルノイズフロアより著しく高いピーク）をすべて検出
  const rawPeaks = [];
  // 周辺5ビン（左右に約120Hz幅）の平均と比較するために安全なマージンを確保
  for (let j = sibilanceMinBin + 5; j < sibilanceMaxBin - 5; j++) {
    const val = avgSpectrum[j];
    const peakFreq = Math.round((j * sampleRate) / fftSize);
    
    // 極大値（ピーク）判定
    if (val > avgSpectrum[j - 1] && val > avgSpectrum[j + 1]) {
      // 1. 鋭いホイッスル共鳴の検出（直近2ビンを除いた左右5ビンの平均）
      const localBins = [
        avgSpectrum[j - 5], avgSpectrum[j - 4], avgSpectrum[j - 3], avgSpectrum[j - 2],
        avgSpectrum[j + 2], avgSpectrum[j + 3], avgSpectrum[j + 4], avgSpectrum[j + 5]
      ];
      const localFloor = localBins.reduce((sum, v) => sum + v, 0) / localBins.length;
      const ratio = val / (localFloor + 1e-9);
      
      const isSunoRange = (peakFreq >= 8800 && peakFreq <= 10200);
      const thresholdMultiplier = isSunoRange ? 1.20 : 1.25;
      
      let isBroad = false;
      let peakQ = 15.0;
      let ratioToUse = ratio;
      let thresholdToUse = thresholdMultiplier;
      
      if (ratio > thresholdMultiplier) {
        // 鋭い金属音（WHISTLE）として検知
        isBroad = false;
        peakQ = 15.0;
      } else {
        // 2. 広範囲な高音の盛り上がり（HUMP：例: 10kHz〜12kHz帯域の膨らみ）を検知するために広い近傍フロアと比較
        let wideSum = 0;
        let wideCount = 0;
        for (let k = j - 30; k <= j + 30; k++) {
          if (k >= sibilanceMinBin && k <= sibilanceMaxBin && (k < j - 8 || k > j + 8)) {
            wideSum += avgSpectrum[k];
            wideCount++;
          }
        }
        const wideFloor = wideSum / (wideCount || 1);
        const ratioWide = val / (wideFloor + 1e-9);
        
        if (ratioWide > 1.30) { // 周辺の広い平均より30%（約2.3dB）以上盛り上がっている場合
          isBroad = true;
          peakQ = 6.0; // 緩やかなノッチ（Q=6.0）で膨らみを滑らかに補正する
          ratioToUse = ratioWide;
          thresholdToUse = 1.30;
        }
      }
      
      if (ratio > thresholdMultiplier || isBroad) {
        // Hiss Reducer (LPF) の遮断天井より高い周波数は、既にLPFで十分減衰されるため
        // イコライザーでの過剰な削り（ダブルカット）を防ぐためにノッチ対象から除外する
        const ceilFreq = 20000.0 - (7000.0 * (sugHissAmount / 100.0));
        if (peakFreq > ceilFreq - 500) {
          continue;
        }

        // 減衰幅の算出
        let cutDb = 0;
        if (isBroad) {
          cutDb = -Math.min(4.5, Math.max(1.5, (ratioToUse - thresholdToUse) * 6.0 + 1.5));
        } else {
          cutDb = -Math.min(6.0, Math.max(1.5, (ratioToUse - thresholdToUse) * 8.0 + 1.5));
        }
        
        // 8500Hz未満のカットは緩和
        if (peakFreq < 8500) {
          cutDb *= 0.85;
        }
        
        rawPeaks.push({
          freq: peakFreq,
          cut: cutDb,
          q: peakQ,
          val: val,
          isSunoRange: isSunoRange,
          isBroad: isBroad,
          // スコア計算：鋭い共鳴（ホイッスル）を最優先にしつつ、広範囲の盛り上がり（ハンプ）もカバー
          score: ratioToUse * (isSunoRange ? 1.5 : 1.0) * (isBroad ? 0.9 : 1.0)
        });
      }
    }
  }

  // 優先度スコアの高い順にソート
  rawPeaks.sort((a, b) => b.score - a.score);

  // 互いに400Hz以上離れた上位最大4個のピークを抽出（削りすぎを防止）
  const filteredPeaks = [];
  for (const peak of rawPeaks) {
    if (filteredPeaks.length >= 6) break;
    const tooClose = filteredPeaks.some(p => Math.abs(p.freq - peak.freq) < 400);
    if (!tooClose) {
      filteredPeaks.push({ freq: peak.freq, cut: peak.cut, q: peak.q, isBroad: peak.isBroad });
    }
  }

  // 3.5. AIジャンル自動判定 (Heuristic Genre Classifier - お勧め提案用)

  // 3.5. AIジャンル自動判定 (Heuristic Genre Classifier)
  let detectedGenre = 'pops';
  if (actualLowMidRatio > 3.2 && actualHighMidRatio > 0.16 && crestFactorDb < 12.8) {
    detectedGenre = 'edm';
  } else if (actualLowMidRatio > 3.1 && actualHighMidRatio <= 0.16 && crestFactorDb < 12.8) {
    detectedGenre = 'hiphop';
  } else if (actualLowMidRatio >= 1.6 && actualLowMidRatio <= 3.3 && crestFactorDb < 15.5) {
    // ロック・メタル・ポップス・ジャズの中間帯域グループ（ステレオ相関と高音特性で詳細分類）
    if (crestFactorDb >= 12.8) {
      // ダイナミクスが広い生音系構成の場合
      if (actualLowMidRatio >= 2.4 && actualLowMidRatio <= 3.1 && avgCorrelation > 0.75 && actualHighMidRatio < 0.12) {
        detectedGenre = 'jazz';
      } else if (actualLowMidRatio < 2.4 && avgCorrelation > 0.75 && actualHighMidRatio < 0.12) {
        detectedGenre = 'acoustic';
      } else {
        // ステレオ幅が広い（avgCorrelation <= 0.75）または高域が明るい場合は、ダイナミックなロック/メタルと判定
        detectedGenre = (actualHighMidRatio > 0.14) ? 'metal' : 'rock';
      }
    } else {
      // 音圧が高い商業系構成の場合
      if (actualHighMidRatio >= 0.11) {
        detectedGenre = (actualHighMidRatio > 0.14) ? 'metal' : 'rock';
      } else {
        detectedGenre = 'pops';
      }
    }
  } else if (crestFactorDb >= 13.0) {
    // 高ダイナミクス極端帯域（クラシック・アンビエント等）
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
  }  // 4. 最適マスタリングパラメーターの動的算出（ターゲット比率への収束）
  // 設計変更: AI AUTO（auto）またはカスタム（custom）の場合は中立なフラット特性（auto）をベースにする。
  // それ以外の個別プリセット（edm, rock等）が選ばれている場合は、そのプリセットをベースにAIが動的に最適化する。
  const genreSelect = document.getElementById('preset-select');
  const userGenreKey = userPresetKey || (genreSelect ? genreSelect.value : 'auto');
  const genreKey = (userGenreKey === 'auto' || userGenreKey === 'custom') ? 'auto' : userGenreKey;
  const basePreset = GENRE_PRESETS[genreKey] || GENRE_PRESETS.auto;
  const genreTargets = {
    auto: { low: 3.1, high: 0.17 }, // AI AUTO: 豊かな低域の伸びとシルキーな高域の空気感
    pops: { low: 2.8, high: 0.18 }, // POPS: 明瞭なボーカルと煌びやかな高域
    rnb: { low: 3.4, high: 0.18 },   // R&B: ディープなサブベースと滑らかな広がり
    rock: { low: 3.1, high: 0.15 },  // ROCK: 厚みのあるキックとエッジの効いた中高域
    metal: { low: 3.3, high: 0.18 }, // METAL: 重低音とScoop-Midギターの壁、鋭いエッジ
    edm: { low: 3.3, high: 0.19 },   // EDM: パワフルなキックとパンチのあるシンセ高域
    hiphop: { low: 3.5, high: 0.16 }, // HIPHOP: 極太の超低域とタイトなアタック
    lofi: { low: 3.5, high: 0.08 },   // LOFI: 温かみのあるローミッドとくすんだビンテージ高域
    hardcore: { low: 3.4, high: 0.20 }, // HARDCORE: 極限のクラブ音圧とサチュレーション
    ambient: { low: 3.2, high: 0.24 },  // AMBIENT: 超ワイドで広がりのある空気感
    podcast: { low: 1.8, high: 0.11 },  // ポッドキャスト: 低域カットと会話明瞭度
    classic: { low: 2.4, high: 0.12 },  // CLASSIC: 生楽器のナチュラルな強弱と奥行き
    jazz: { low: 3.0, high: 0.14 },     // JAZZ: ウッディなベースと有機的なホーン中域
    acoustic: { low: 2.5, high: 0.15 }, // ACOUSTIC: 繊細な弦のピッキングと豊かな生音ボディ
    custom: { low: 3.1, high: 0.17 }
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
    eqLowAdjustment = Math.min(2.2, -lowDiffDb * 0.75); // 不足分を足す（低域割れ防止のため最大+2.2dBに制限）
  }
  // 低域EQブーストを最大 +3.0 dB、カットを最大 -5.0 dB に制限して割れを防止
  const eqLowGain = Math.max(-5.0, Math.min(3.0, Math.round((basePreset.eqLowGain + eqLowAdjustment) * 2) / 2));

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
    compThreshold = Math.max(-10.0, basePreset.compThreshold - 1.5); // マイルドに下げる（最大でも-10.0dBまでに抑制）
    compRatio = Math.min(1.45, basePreset.compRatio + 0.1);         // 低めの比率に抑制してポンピング（ほわほわ音）を防止
    crestDesc = "High (Highly Dynamic)";
    const bonus = Math.min(1.0, crestDiff * 0.25); // マイルドな加算に調整
    limiterBoost = baseBoost + bonus;
  } else if (crestDiff < -1.5) {
    // 音源が既に圧縮されている場合 -> 二重圧縮による歪みを防ぐため、圧縮を極めて浅くし、ブーストを適度に抑制
    compThreshold = Math.min(-6.0, basePreset.compThreshold + 1.5); // 圧縮しすぎないように浅いしきい値
    compRatio = Math.max(1.15, basePreset.compRatio - 0.15);       // 低い圧縮比率
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
    detectedGenre: detectedGenre,
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

    // 2. Rumble high-pass filter
    this.rumbleFilter = context.createBiquadFilter();
    this.rumbleFilter.type = 'highpass';
    this.rumbleFilter.frequency.setValueAtTime(18.0, context.currentTime); // 18Hz subsonic filter when disabled
    this.rumbleFilter.Q.setValueAtTime(0.707, context.currentTime);

    // 3. Dynamic Hiss Filter (VCF Lowpass)
    this.hissFilter = context.createBiquadFilter();
    this.hissFilter.type = 'lowpass';
    this.hissFilter.frequency.setValueAtTime(20000.0, context.currentTime);
    this.hissFilter.Q.setValueAtTime(0.5, context.currentTime);

    // 3b. Sidechain Envelope Follower (Lowered crossover to 2kHz for vocal body)
    this.sidechainHpf = context.createBiquadFilter();
    this.sidechainHpf.type = 'highpass';
    this.sidechainHpf.frequency.setValueAtTime(2000.0, context.currentTime);
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

    // Dedicated Kick Peaking Filter (55Hz, narrow Q=2.0)
    this.kickPeaking = context.createBiquadFilter();
    this.kickPeaking.type = 'peaking';
    this.kickPeaking.frequency.setValueAtTime(55.0, context.currentTime);
    this.kickPeaking.Q.setValueAtTime(2.0, context.currentTime);

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
      this[`eqCorrective${i}`].Q.setValueAtTime(18.0, context.currentTime);
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

    // 9. Maximizer & Limiter (Near-instant 0.1ms attack, 80ms release)
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
    const baseFreq = 20000.0 - (16250.0 * (hissAmount / 100.0)); // Maps 80% to 7,000Hz and 100% to 3,750Hz
    this.hissFilter.frequency.setTargetAtTime(baseFreq, t, 0.05);
    
    // 高域ヒスノイズ（13kHz〜20kHz）が楽曲再生中も完全に消え去るよう、上限遮断周波数（天井）を制限
    const ceilFreq = 20000.0 - (7000.0 * (hissAmount / 100.0)); // hissAmount=100%で最大天井を13,000Hzに固定
    const maxEnvGain = Math.max(0, ceilFreq - baseFreq);
    this.hissEnvelopeGain.gain.setTargetAtTime(maxEnvGain, t, 0.05);

    // 4. Parallel Saturation
    const blend = params.satMix / 100.0;
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