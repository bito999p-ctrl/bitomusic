import { AetherEnhancer, analyzeAudioResonances } from './audio-engine.js';

// --- State Variables ---
let audioCtx = null;
let enhancer = null;
let analyser = null;
let sourceNode = null;

let tracks = [];
let currentTrackIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 'all'; // 'all', 'one', 'none'
let loadedUrl = '';

// Background Analysis Coordination
let currentAnalysisId = 0;
let activeAbortController = null;

// --- DOM Elements ---
const landingScreen = document.getElementById('landing-screen');
const playerWorkspace = document.getElementById('player-workspace');
const landingInput = document.getElementById('landing-input');
const landingBtn = document.getElementById('landing-btn');
const landingBtnText = document.getElementById('landing-btn-text');
const landingBtnLoader = document.getElementById('landing-btn-loader');
const backToLandingBtn = document.getElementById('back-to-landing-btn');
const shareBtn = document.getElementById('share-btn');

// Sidebar Info
const sourceCover = document.getElementById('source-cover');
const sourceName = document.getElementById('source-name');
const sourceType = document.getElementById('source-type');
const playlistsSection = document.getElementById('playlists-section');
const playlistsList = document.getElementById('playlists-list');
const tracksCountEl = document.getElementById('tracks-count');
const tracksList = document.getElementById('tracks-list');

// Player Main
const trackArtwork = document.getElementById('track-artwork');
const artworkWrapper = document.querySelector('.artwork-wrapper');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationTimeEl = document.getElementById('duration-time');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const volumeSlider = document.getElementById('volume-slider');
const visModeSelect = document.getElementById('vis-mode-select');
const canvas = document.getElementById('player-visualizer');
const canvasCtx = canvas.getContext('2d');

// AI HUD UI Elements
const enhancerToggle = document.getElementById('enhancer-toggle');
const aiStatusEl = document.getElementById('ai-status');
const notchesListEl = document.getElementById('notches-list');
const hudEqLowEl = document.getElementById('hud-eq-low');
const hudEqHighEl = document.getElementById('hud-eq-high');
const hudWidthEl = document.getElementById('hud-width');
const hudHissEl = document.getElementById('hud-hiss');
const hudCompThreshEl = document.getElementById('hud-comp-thresh');
const hudCompRatioEl = document.getElementById('hud-comp-ratio');
const hudLimiterBoostEl = document.getElementById('hud-limiter-boost');

const grValue = document.getElementById('gr-value');
const grBarFill = document.getElementById('gr-bar-fill');

// Tabs & Lyrics
const tabEnhancerBtn = document.getElementById('tab-enhancer-btn');
const tabLyricsBtn = document.getElementById('tab-lyrics-btn');
const tabEnhancer = document.getElementById('tab-enhancer');
const tabLyrics = document.getElementById('tab-lyrics');
const lyricsText = document.getElementById('lyrics-text');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Check URL query parameters for auto-import
  checkUrlParams();
});

// --- Audio Context Lazy Setup ---
function initAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create MediaElementSource
  sourceNode = audioCtx.createMediaElementSource(audioPlayer);

  // Initialize Enhancer
  enhancer = new AetherEnhancer(audioCtx);

  // Setup Analyser
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;

  // Connect graph: Source -> Enhancer -> Analyser -> Destination
  sourceNode.connect(enhancer.inputNode);
  enhancer.outputNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  console.log('[AudioEngine] Web Audio graph initialized.');

  // Sync initial bypass check
  enhancer.setBypass(!enhancerToggle.checked);

  // Start visualizer animation loop
  requestAnimationFrame(drawVisualizer);
  // Start compressor GR meter loop
  setInterval(updateCompressionMeter, 100);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Landing screen actions
  landingBtn.addEventListener('click', () => importSunoUrl(landingInput.value));
  landingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') importSunoUrl(landingInput.value);
  });

  // Quick link buttons
  document.querySelectorAll('.quick-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      landingInput.value = url;
      importSunoUrl(url);
    });
  });

  // Workspace actions
  backToLandingBtn.addEventListener('click', showLandingView);
  shareBtn.addEventListener('click', copyShareLink);

  // Player controls
  playPauseBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);
  shuffleBtn.addEventListener('click', toggleShuffle);
  repeatBtn.addEventListener('click', toggleRepeat);

  // Progress / Seek
  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('loadedmetadata', onTrackLoaded);
  audioPlayer.addEventListener('ended', onTrackEnded);
  
  progressBar.addEventListener('input', () => {
    if (audioPlayer.duration) {
      const seekTime = (progressBar.value / 100) * audioPlayer.duration;
      audioPlayer.currentTime = seekTime;
    }
  });

  // Volume
  volumeSlider.addEventListener('input', () => {
    audioPlayer.volume = volumeSlider.value / 100;
  });

  // Tab switching
  tabEnhancerBtn.addEventListener('click', () => switchTab('enhancer'));
  tabLyricsBtn.addEventListener('click', () => switchTab('lyrics'));

  // Enhancer Toggle (Bypass)
  enhancerToggle.addEventListener('change', () => {
    initAudio();
    if (enhancer) {
      enhancer.setBypass(!enhancerToggle.checked);
    }
  });
}

// --- Import Suno Data & Screen Navigation ---
async function importSunoUrl(urlStr) {
  if (!urlStr.trim()) return;

  // Show loading state on landing button
  landingBtnText.classList.add('hidden');
  landingBtnLoader.classList.remove('hidden');
  landingBtn.disabled = true;

  try {
    const res = await fetch(`/api/suno?url=${encodeURIComponent(urlStr)}`);
    const data = await res.json();

    if (data.error) {
      alert(`インポート失敗: ${data.error}`);
      return;
    }

    tracks = data.tracks || [];
    currentTrackIndex = -1;
    isPlaying = false;
    audioPlayer.pause();
    
    // Update active UI details
    tracksCountEl.textContent = tracks.length;
    renderTracksList();

    // Set source details in workspace sidebar
    sourceName.textContent = data.name || 'Suno Catalog';
    sourceType.textContent = data.type === 'profile' ? 'Artist Profile' : 'Playlist';
    
    if (tracks.length > 0 && tracks[0].image_url) {
      sourceCover.src = tracks[0].image_url;
    } else {
      sourceCover.src = 'https://cdn1.suno.ai/image_large_00000000-0000-0000-0000-000000000000.png';
    }

    // Populate user playlists if type is profile
    if (data.type === 'profile' && data.playlists && data.playlists.length > 0) {
      playlistsSection.classList.remove('hidden');
      renderPlaylistsList(data.playlists);
    } else {
      playlistsSection.classList.add('hidden');
    }

    // Save imported URL state
    loadedUrl = urlStr.trim();

    // Update query parameters in the address bar dynamically
    updateAddressBar(loadedUrl);

    // Transition Screens: Hide landing, Show player
    landingScreen.classList.add('hidden');
    playerWorkspace.classList.remove('hidden');
    resizeCanvas(); // Ensure canvas matches new dimensions

    // Auto play first track
    if (tracks.length > 0) {
      selectTrack(0);
    } else {
      alert('公開曲が見つかりませんでした。プライバシー設定を確認してください。');
    }

  } catch (err) {
    console.error(err);
    alert(`エラーが発生しました: ${err.message}`);
  } finally {
    landingBtnText.classList.remove('hidden');
    landingBtnLoader.classList.add('hidden');
    landingBtn.disabled = false;
  }
}

// --- Screen State Control ---
function showLandingView() {
  // Stop audio playback
  audioPlayer.pause();
  isPlaying = false;
  playPauseBtn.innerHTML = '<span class="icon-play">▶</span>';
  artworkWrapper.classList.remove('playing');

  // Cancel any active analyses
  currentAnalysisId++;
  if (activeAbortController) {
    activeAbortController.abort();
  }

  // Clear query parameters from browser URL
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);

  // Transition Screens: Hide player, Show landing
  playerWorkspace.classList.add('hidden');
  landingScreen.classList.remove('hidden');

  // Clear landing input
  landingInput.value = '';
}

// --- Render Sidebar Items ---
function renderTracksList() {
  tracksList.innerHTML = '';
  
  if (tracks.length === 0) {
    tracksList.innerHTML = '<div class="empty-list">曲が読み込まれていません</div>';
    return;
  }

  tracks.forEach((track, idx) => {
    const item = document.createElement('div');
    item.className = `track-item ${idx === currentTrackIndex ? 'active' : ''}`;
    item.dataset.index = idx;
    
    const formattedPlays = track.play_count >= 1000 
      ? (track.play_count / 1000).toFixed(1) + 'k' 
      : track.play_count;

    item.innerHTML = `
      <div class="track-item-num">${idx + 1}</div>
      <img src="${track.image_url}" alt="Cover" class="track-item-cover" onerror="this.src='https://cdn1.suno.ai/image_large_00000000-0000-0000-0000-000000000000.png'">
      <div class="track-item-meta">
        <div class="track-item-title">${escapeHtml(track.title)}</div>
        <div class="track-item-artist">${escapeHtml(track.artist_name)}</div>
      </div>
      <div class="track-item-playcount">
        <span>🔥</span> ${formattedPlays}
      </div>
    `;

    item.addEventListener('click', () => selectTrack(idx));
    tracksList.appendChild(item);
  });
}

function renderPlaylistsList(playlists) {
  playlistsList.innerHTML = '';
  playlists.forEach(pl => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <img src="${pl.image_url}" alt="Cover" class="playlist-thumb" onerror="this.src='https://cdn1.suno.ai/image_large_00000000-0000-0000-0000-000000000000.png'">
      <div class="playlist-name">${escapeHtml(pl.name)}</div>
    `;
    item.addEventListener('click', () => {
      importSunoUrl(pl.url);
    });
    playlistsList.appendChild(item);
  });
}

// --- Track Selection ---
function selectTrack(idx) {
  if (idx < 0 || idx >= tracks.length) return;

  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  currentTrackIndex = idx;
  const track = tracks[idx];

  // Update track active class in list
  const items = tracksList.querySelectorAll('.track-item');
  items.forEach((item, i) => {
    if (i === idx) item.classList.add('active');
    else item.classList.remove('active');
  });

  // Set Player UI metadata
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist_name;
  trackArtwork.src = track.image_url;
  
  // Set Lyrics
  if (track.description) {
    lyricsText.textContent = track.description;
  } else {
    lyricsText.innerHTML = '<div class="empty-list">インスト曲または歌詞が見つかりません。</div>';
  }

  // Load stream
  audioPlayer.src = track.audio_url;
  audioPlayer.volume = volumeSlider.value / 100;
  
  // Auto-play
  isPlaying = true;
  audioPlayer.play()
    .then(() => {
      playPauseBtn.innerHTML = '<span class="icon-play">⏸</span>';
      artworkWrapper.classList.add('playing');
    })
    .catch(err => {
      console.warn('Playback block:', err.message);
      isPlaying = false;
      playPauseBtn.innerHTML = '<span class="icon-play">▶</span>';
      artworkWrapper.classList.remove('playing');
    });

  // Trigger background AI Auto Analysis
  currentAnalysisId++;
  analyzeAndApplyAutoMastering(track, currentAnalysisId);
}

// --- AI Auto Mastering Analysis ---
async function analyzeAndApplyAutoMastering(track, analysisId) {
  updateAiStatus('analyzing');
  applyDefaultAutoParams(); // Load defaults immediately so audio plays enhanced

  try {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    console.log(`[AI Auto] Fetching audio file for analysis: ${track.audio_url}`);
    const response = await fetch(track.audio_url, { signal: activeAbortController.signal });
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();

    if (analysisId !== currentAnalysisId) return;

    console.log('[AI Auto] Decoding audio channel buffers...');
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    if (analysisId !== currentAnalysisId) return;

    console.log('[AI Auto] Running AetherMaster spectral resonance & dynamics analysis...');
    const result = analyzeAudioResonances(decodedBuffer);
    console.log('[AI Auto] Analysis complete. Parameters calculated:', result);

    if (analysisId !== currentAnalysisId) return;

    // Apply the optimal dynamic mastering parameters to the Web Audio engine
    if (enhancer) {
      enhancer.setMasteringParams(result.suggestedParams, result.notches);
    }

    // Update AI HUD UI
    updateAiHudUI(result);
    updateAiStatus('active');

  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[AI Auto] Analysis aborted (track changed).');
      return;
    }
    console.error('[AI Auto] AI Analysis failed:', err);
    updateAiStatus('failed');
  }
}

// --- UI HUD Updates ---
function updateAiStatus(status) {
  aiStatusEl.className = `status-badge ${status}`;
  if (status === 'analyzing') {
    aiStatusEl.textContent = 'ANALYZING...';
  } else if (status === 'active') {
    aiStatusEl.textContent = 'ACTIVE';
  } else if (status === 'failed') {
    aiStatusEl.textContent = 'FAILED (STD)';
  } else {
    aiStatusEl.textContent = 'STANDBY';
  }
}

function updateAiHudUI(result) {
  const sug = result.suggestedParams;

  // EQ, Width, Hiss
  hudEqLowEl.textContent = `${sug.eqLowGain > 0 ? '+' : ''}${sug.eqLowGain.toFixed(1)} dB`;
  hudEqHighEl.textContent = `${sug.eqHighGain > 0 ? '+' : ''}${sug.eqHighGain.toFixed(1)} dB`;
  hudWidthEl.textContent = `${sug.stereoWidth.toFixed(2)}x`;
  hudHissEl.textContent = `${sug.hissReductionAmount}%`;

  // Dynamics
  hudCompThreshEl.textContent = `${sug.compThreshold.toFixed(1)} dB`;
  hudCompRatioEl.textContent = `${sug.compRatio.toFixed(2)}:1`;
  hudLimiterBoostEl.textContent = `+${sug.limiterBoost.toFixed(1)} dB`;

  // Notch Filters
  notchesListEl.innerHTML = '';
  if (result.notches && result.notches.length > 0) {
    result.notches.forEach((notch, idx) => {
      const el = document.createElement('div');
      el.className = 'notch-item';
      el.innerHTML = `
        <span>Notch #${idx + 1} (${notch.freq} Hz)</span>
        <span>${notch.cut.toFixed(1)} dB</span>
      `;
      notchesListEl.appendChild(el);
    });
  } else {
    notchesListEl.innerHTML = '<div class="empty-notches">耳障りな周波数は検出されませんでした</div>';
  }
}

function applyDefaultAutoParams() {
  const defaultParams = {
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
  };
  
  if (enhancer) {
    enhancer.setMasteringParams(defaultParams, []);
  }

  // Set default HUD display values
  hudEqLowEl.textContent = '0.0 dB';
  hudEqHighEl.textContent = '0.0 dB';
  hudWidthEl.textContent = '1.15x';
  hudHissEl.textContent = '0%';
  hudCompThreshEl.textContent = '-15.0 dB';
  hudCompRatioEl.textContent = '1.60:1';
  hudLimiterBoostEl.textContent = '+3.5 dB';
  notchesListEl.innerHTML = '<div class="empty-notches">分析待ち...</div>';
}

// --- Player Controls Trigger Helpers ---
function togglePlay() {
  if (tracks.length === 0) return;

  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    playPauseBtn.innerHTML = '<span class="icon-play">▶</span>';
    artworkWrapper.classList.remove('playing');
  } else {
    if (currentTrackIndex === -1) {
      selectTrack(0);
      return;
    }
    audioPlayer.play();
    isPlaying = true;
    playPauseBtn.innerHTML = '<span class="icon-play">⏸</span>';
    artworkWrapper.classList.add('playing');
  }
}

function playNext() {
  if (tracks.length === 0) return;

  if (isShuffle) {
    const rand = Math.floor(Math.random() * tracks.length);
    selectTrack(rand);
  } else {
    let nextIdx = currentTrackIndex + 1;
    if (nextIdx >= tracks.length) {
      nextIdx = 0;
    }
    selectTrack(nextIdx);
  }
}

function playPrev() {
  if (tracks.length === 0) return;

  let prevIdx = currentTrackIndex - 1;
  if (prevIdx < 0) {
    prevIdx = tracks.length - 1;
  }
  selectTrack(prevIdx);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
}

// Repeat State Control
function toggleRepeat() {
  if (repeatMode === 'all') {
    repeatMode = 'one';
    repeatBtn.classList.add('active');
    repeatBtn.innerHTML = '<span class="icon">🔂</span>';
  } else if (repeatMode === 'one') {
    repeatMode = 'none';
    repeatBtn.classList.remove('active');
    repeatBtn.innerHTML = '<span class="icon">🔁</span>';
    repeatBtn.style.opacity = '0.4';
  } else {
    repeatMode = 'all';
    repeatBtn.classList.remove('active');
    repeatBtn.innerHTML = '<span class="icon">🔁</span>';
    repeatBtn.style.opacity = '1';
  }
}

function onTrackEnded() {
  if (repeatMode === 'one') {
    audioPlayer.currentTime = 0;
    audioPlayer.play();
  } else if (repeatMode === 'all' || isShuffle) {
    playNext();
  } else {
    if (currentTrackIndex < tracks.length - 1) {
      playNext();
    } else {
      isPlaying = false;
      playPauseBtn.innerHTML = '<span class="icon-play">▶</span>';
      artworkWrapper.classList.remove('playing');
    }
  }
}

// --- Seek & Loader Meta ---
function onTrackLoaded() {
  progressBar.value = 0;
  currentTimeEl.textContent = '0:00';
  durationTimeEl.textContent = formatTime(audioPlayer.duration);
}

function updateProgressBar() {
  if (audioPlayer.duration) {
    const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = percentage;
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
  }
}

// --- Compressor Gain Reduction Meter ---
function updateCompressionMeter() {
  if (!enhancer || !enhancerToggle.checked || enhancer.isBypassed) {
    grValue.textContent = '0.0 dB';
    grBarFill.style.width = '0%';
    return;
  }

  let reduction = enhancer.compressor.reduction;
  if (typeof reduction === 'object' && reduction.value !== undefined) {
    reduction = reduction.value;
  }
  if (isNaN(reduction) || reduction >= 0) {
    reduction = 0;
  }

  const absReduction = Math.abs(reduction);
  grValue.textContent = `${absReduction.toFixed(1)} dB`;
  const percent = Math.min(100, (absReduction / 15) * 100);
  grBarFill.style.width = `${percent}%`;
}

// --- Visualizer Canvas Rendering ---
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}

function drawVisualizer() {
  if (!analyser) return;

  requestAnimationFrame(drawVisualizer);

  const width = canvas.width;
  const height = canvas.height;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const mode = visModeSelect.value;

  if (mode === 'oscilloscope') {
    analyser.getByteTimeDomainData(dataArray);
  } else {
    analyser.getByteFrequencyData(dataArray);
  }

  canvasCtx.clearRect(0, 0, width, height);

  if (mode === 'pulse-ring') {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = 90;

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const pulseFactor = 1.0 + (average / 255.0) * 0.15;

    // Glowing circle
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, baseRadius * pulseFactor, 0, 2 * Math.PI);
    canvasCtx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    canvasCtx.lineWidth = 4;
    canvasCtx.shadowBlur = 15;
    canvasCtx.shadowColor = '#00f2fe';
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;

    // Spikes
    const spikeCount = 80;
    const step = (2 * Math.PI) / spikeCount;
    
    for (let i = 0; i < spikeCount; i++) {
      const dataIdx = Math.floor((i / spikeCount) * (bufferLength / 2));
      const val = dataArray[dataIdx] || 0;
      const spikeLength = (val / 255.0) * 45;
      
      const angle = i * step;
      const startX = centerX + Math.cos(angle) * (baseRadius * pulseFactor);
      const startY = centerY + Math.sin(angle) * (baseRadius * pulseFactor);
      const endX = centerX + Math.cos(angle) * (baseRadius * pulseFactor + spikeLength);
      const endY = centerY + Math.sin(angle) * (baseRadius * pulseFactor + spikeLength);
      
      const grad = canvasCtx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, '#00f2fe');
      grad.addColorStop(1, '#a100ff');

      canvasCtx.beginPath();
      canvasCtx.moveTo(startX, startY);
      canvasCtx.lineTo(endX, endY);
      canvasCtx.strokeStyle = grad;
      canvasCtx.lineWidth = 2.5;
      canvasCtx.stroke();
    }

  } else if (mode === 'bars') {
    const barWidth = (width / (bufferLength / 2)) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength / 2; i++) {
      const val = dataArray[i];
      const barHeight = (val / 255.0) * (height / 2);

      const grad = canvasCtx.createLinearGradient(x, height, x, height - barHeight);
      grad.addColorStop(0, '#00f2fe');
      grad.addColorStop(1, 'rgba(161, 0, 255, 0.8)');

      canvasCtx.fillStyle = grad;
      canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

      x += barWidth;
    }

  } else if (mode === 'oscilloscope') {
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = '#00f2fe';
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = '#00f2fe';
    canvasCtx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
  }
}

// --- Query Param Handler ---
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const user = urlParams.get('user');
  const playlist = urlParams.get('playlist');
  const exactUrl = urlParams.get('url');

  if (playlist) {
    importSunoUrl(`https://suno.com/playlist/${playlist}`);
  } else if (user) {
    importSunoUrl(`https://suno.com/@${user}`);
  } else if (exactUrl) {
    importSunoUrl(exactUrl);
  }
}

// Update address bar query parameters to reflect the active URL state
function updateAddressBar(urlInput) {
  let shareParams = '';

  if (urlInput.includes('/playlist/')) {
    const plMatch = urlInput.match(/\/playlist\/([a-f0-9\-]{36})/i);
    if (plMatch) shareParams = `?playlist=${plMatch[1]}`;
    else shareParams = `?url=${encodeURIComponent(urlInput)}`;
  } else if (urlInput.includes('/@')) {
    const userMatch = urlInput.match(/\/@([a-zA-Z0-9_\-]+)/i);
    if (userMatch) shareParams = `?user=${userMatch[1]}`;
    else shareParams = `?url=${encodeURIComponent(urlInput)}`;
  } else if (urlInput.startsWith('@')) {
    shareParams = `?user=${urlInput.replace('@', '')}`;
  } else if (/^[a-f0-9\-]{36}$/i.test(urlInput)) {
    shareParams = `?playlist=${urlInput}`;
  } else {
    shareParams = `?url=${encodeURIComponent(urlInput)}`;
  }

  const newUrl = window.location.origin + window.location.pathname + shareParams;
  window.history.replaceState({}, document.title, newUrl);
}

function copyShareLink() {
  if (tracks.length === 0) return;
  const shareUrl = window.location.href;

  navigator.clipboard.writeText(shareUrl)
    .then(() => {
      alert(`共有用リンクをクリップボードにコピーしました！\n${shareUrl}`);
    })
    .catch(err => {
      console.error(err);
      alert(`リンクのコピーに失敗しました: ${shareUrl}`);
    });
}

// --- Utility Helpers ---
function switchTab(tab) {
  if (tab === 'enhancer') {
    tabEnhancerBtn.classList.add('active');
    tabLyricsBtn.classList.remove('active');
    tabEnhancer.classList.remove('hidden');
    tabLyrics.classList.add('hidden');
  } else {
    tabEnhancerBtn.classList.remove('active');
    tabLyricsBtn.classList.add('active');
    tabEnhancer.classList.add('hidden');
    tabLyrics.classList.remove('hidden');
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
