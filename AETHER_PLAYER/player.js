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
let userProfileData = null;

// Pre-fetching Cache
const analysisCache = new Map();
let preFetchingUrl = '';

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
const audioPlayer = document.getElementById('audio-player');

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
  
  // Render recent history on startup
  renderHistoryUI();
  
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

  // History Dropdown Toggle
  const historyToggleBtn = document.getElementById('history-toggle-btn');
  const headerHistoryDropdown = document.getElementById('header-history-dropdown');
  if (historyToggleBtn && headerHistoryDropdown) {
    historyToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      headerHistoryDropdown.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!headerHistoryDropdown.contains(e.target) && e.target !== historyToggleBtn) {
        headerHistoryDropdown.classList.add('hidden');
      }
    });
  }

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
async function importSunoUrl(urlStr, isSubRequest = false) {
  if (!urlStr.trim()) return;

  // Show loading state on landing button
  landingBtnText.classList.add('hidden');
  landingBtnLoader.classList.remove('hidden');
  landingBtn.disabled = true;

  try {
    const res = await fetch(`/api/suno?url=${encodeURIComponent(urlStr)}`);
    
    // Check if the response is valid JSON
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error('[Error] Server returned non-JSON response:', text);
      
      let errorMsg = `サーバーエラー (ステータス: ${res.status})`;
      if (text.includes('502 Bad Gateway') || text.includes('502')) {
        errorMsg += '\n\n【原因】Node.jsサーバー(server.js)が起動していない、またはNginxなどのリバースプロキシ設定が正しくありません。`node server.js`を起動してください。';
      } else if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        errorMsg += '\n\n【原因】APIへのリクエストがHTMLページ(インデックスや404)にリダイレクトされています。静的ホスティング(GitHub Pagesなど)ではNode.jsバックエンドが動かないため、エラーになります。';
      } else {
        errorMsg += `:\n${text.slice(0, 150)}`;
      }
      
      alert(errorMsg);
      return;
    }

    const data = await res.json();

    if (data.error) {
      alert(`インポート失敗: ${data.error}`);
      return;
    }

    // Save profile data only if it is the main (parent) request
    if (!isSubRequest) {
      if (data.type === 'profile') {
        userProfileData = data;
      } else {
        userProfileData = null;
      }
    }

    tracks = data.tracks || [];
    currentTrackIndex = -1;
    isPlaying = false;
    audioPlayer.pause();
    
    // Update active UI details
    tracksCountEl.textContent = tracks.length;
    renderTracksList();

    // Show/hide limit warning dynamically in sidebar
    const limitWarning = document.getElementById('sidebar-limit-warning');
    if (limitWarning) {
      if ((data.type === 'profile' && tracks.length === 20) || (data.type === 'playlist' && tracks.length === 50)) {
        limitWarning.classList.remove('hidden');
      } else {
        limitWarning.classList.add('hidden');
      }
    }

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
      // If loading a playlist as a sub-request, keep the playlists section visible so we can return/switch!
      if (!isSubRequest) {
        playlistsSection.classList.add('hidden');
      }
    }

    // Save imported URL state
    loadedUrl = urlStr.trim();

    // Add to recent history (skip sub requests)
    if (!isSubRequest) {
      saveToHistory(data.type, loadedUrl, data.name || (data.type === 'profile' ? loadedUrl : 'Suno Item'));
    }

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

  // Clear cache & prefetch values
  analysisCache.clear();
  preFetchingUrl = '';
  userProfileData = null;

  // Hide Suno link
  const sunoLink = document.getElementById('suno-link');
  if (sunoLink) {
    sunoLink.classList.add('hidden');
    sunoLink.href = '#';
  }

  // Clear query parameters from browser URL
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);

  // Transition Screens: Hide player, Show landing
  playerWorkspace.classList.add('hidden');
  landingScreen.classList.remove('hidden');

  // Refresh history UI
  renderHistoryUI();

  // Clear landing input
  landingInput.value = '';
}

// --- Render Sidebar Items ---
function renderTracksList() {
  tracksList.innerHTML = '';

  // If a sub-playlist is loaded but we have the parent profile in memory, render a return button!
  if (userProfileData && loadedUrl && !loadedUrl.includes('/@') && !loadedUrl.includes('%40')) {
    const backBtn = document.createElement('div');
    backBtn.className = 'back-to-profile-item';
    backBtn.innerHTML = `
      <span class="back-icon">⬅</span>
      <span class="back-text">${escapeHtml(userProfileData.name)} の公開曲に戻る</span>
    `;
    backBtn.addEventListener('click', restoreProfileView);
    tracksList.appendChild(backBtn);
  }
  
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
      importSunoUrl(pl.url, true); // Pass true to preserve userProfileData!
    });
    playlistsList.appendChild(item);
  });
}

function restoreProfileView() {
  if (!userProfileData) return;

  tracks = userProfileData.tracks;
  currentTrackIndex = -1;
  loadedUrl = userProfileData.url;

  // Restore sidebar headers
  sourceName.textContent = userProfileData.name;
  sourceType.textContent = 'Artist Profile';
  
  if (tracks.length > 0 && tracks[0].image_url) {
    sourceCover.src = tracks[0].image_url;
  }

  // Show playlists section again
  playlistsSection.classList.remove('hidden');

  // Render tracks
  renderTracksList();

  // Sync address bar back to profile URL
  updateAddressBar(loadedUrl);
}

// --- Track Selection & Master Sync ---
async function selectTrack(idx) {
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

  // Set Suno external link
  const sunoLink = document.getElementById('suno-link');
  if (sunoLink) {
    sunoLink.href = `https://suno.com/song/${track.id}`;
    sunoLink.classList.remove('hidden');
  }
  
  // Set Lyrics
  if (track.description) {
    lyricsText.textContent = track.description;
  } else {
    lyricsText.innerHTML = '<div class="empty-list">インスト曲または歌詞が見つかりません。</div>';
  }

  // Stop current player first, ensuring no overlap
  audioPlayer.pause();
  audioPlayer.src = '';
  isPlaying = false;
  playPauseBtn.innerHTML = '<span class="icon-play">▶</span>';
  artworkWrapper.classList.remove('playing');

  // Trigger analysis or use cache
  currentAnalysisId++;
  const analysisId = currentAnalysisId;

  const cachedResult = analysisCache.get(track.audio_url);
  if (cachedResult) {
    console.log(`[AI Auto] Using pre-analyzed cache for: ${track.title}`);
    if (enhancer) {
      enhancer.setMasteringParams(cachedResult.suggestedParams, cachedResult.notches);
    }
    updateAiHudUI(cachedResult);
    updateAiStatus('active');
    
    // Play immediately with correct parameters applied!
    startPlayback(track.audio_url);
  } else {
    // Show Analyzing loader UI in player, lock controls
    updateAiStatus('analyzing');
    playPauseBtn.disabled = true;
    playPauseBtn.style.opacity = '0.5';
    trackTitle.textContent = `${track.title} (AI分析中...)`;

    try {
      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController();

      console.log(`[AI Auto] Fetching audio for analysis: ${track.audio_url}`);
      const response = await fetch(track.audio_url, { signal: activeAbortController.signal });
      if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      if (analysisId !== currentAnalysisId) return;

      console.log('[AI Auto] Decoding audio channel buffers...');
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (analysisId !== currentAnalysisId) return;

      console.log('[AI Auto] Running AetherMaster spectral resonance & dynamics analysis...');
      const result = analyzeAudioResonances(decodedBuffer);
      if (analysisId !== currentAnalysisId) return;

      // Cache the result for instant replay/gapless next transitions
      analysisCache.set(track.audio_url, result);

      // Apply the optimal dynamic mastering parameters to the Web Audio engine
      if (enhancer) {
        enhancer.setMasteringParams(result.suggestedParams, result.notches);
      }

      // Update AI HUD UI
      updateAiHudUI(result);
      updateAiStatus('active');

      // Enable controls & Start Playback with mastered audio!
      playPauseBtn.disabled = false;
      playPauseBtn.style.opacity = '1';
      trackTitle.textContent = track.title;
      startPlayback(track.audio_url);

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[AI Auto] Analysis aborted (track changed).');
        return;
      }
      console.error('[AI Auto] AI Analysis failed:', err);
      updateAiStatus('failed');

      // Enable controls & Start default playback
      playPauseBtn.disabled = false;
      playPauseBtn.style.opacity = '1';
      trackTitle.textContent = track.title;
      applyDefaultAutoParams();
      startPlayback(track.audio_url);
    }
  }
}

// --- Start Track Playback ---
function startPlayback(url) {
  audioPlayer.src = url;
  audioPlayer.volume = volumeSlider.value / 100;
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
}

// --- Pre-fetch & Pre-analyze Background workers ---
async function runPreAnalysis(track) {
  const url = track.audio_url;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const result = analyzeAudioResonances(decodedBuffer);
    
    analysisCache.set(url, result);
    console.log(`[Pre-Fetch] Pre-analysis complete and cached for: ${track.title}`);
  } catch (err) {
    console.warn(`[Pre-Fetch] Failed to pre-analyze ${track.title}:`, err.message);
  } finally {
    if (preFetchingUrl === url) {
      preFetchingUrl = '';
    }
  }
}

function checkAndPreFetchNextTrack() {
  if (tracks.length <= 1) return;
  if (!audioPlayer.duration || audioPlayer.paused) return;

  const timeLeft = audioPlayer.duration - audioPlayer.currentTime;
  // Trigger pre-fetch when less than 20 seconds remain or progress is > 85%
  if (timeLeft < 20 || (audioPlayer.currentTime / audioPlayer.duration) > 0.85) {
    let nextIdx = -1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * tracks.length);
      if (nextIdx === currentTrackIndex) {
        nextIdx = (nextIdx + 1) % tracks.length;
      }
    } else {
      nextIdx = (currentTrackIndex + 1) % tracks.length;
    }

    if (nextIdx !== -1 && nextIdx < tracks.length) {
      const nextTrack = tracks[nextIdx];
      const url = nextTrack.audio_url;

      if (!analysisCache.has(url) && preFetchingUrl !== url) {
        preFetchingUrl = url;
        console.log(`[Pre-Fetch] Starting background pre-analysis for: ${nextTrack.title}`);
        runPreAnalysis(nextTrack);
      }
    }
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

    // Check and trigger pre-fetching in the background
    checkAndPreFetchNextTrack();
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

    // Glowing circle (Rose Gold)
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, baseRadius * pulseFactor, 0, 2 * Math.PI);
    canvasCtx.strokeStyle = 'rgba(232, 165, 148, 0.35)';
    canvasCtx.lineWidth = 4;
    canvasCtx.shadowBlur = 15;
    canvasCtx.shadowColor = '#e8a598';
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;

    // Spikes (Rose Gold to Champagne Gold gradient)
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
      grad.addColorStop(0, '#e8a598');
      grad.addColorStop(1, '#e6c594');

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
      grad.addColorStop(0, '#e8a598');
      grad.addColorStop(1, 'rgba(230, 197, 148, 0.7)');

      canvasCtx.fillStyle = grad;
      canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

      x += barWidth;
    }

  } else if (mode === 'oscilloscope') {
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = '#e8a598';
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = '#e8a598';
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

// Helper to extract username from URL
function getUsernameFromUrl(url) {
  if (!url) return '';
  const match = url.match(/\/@([a-zA-Z0-9_\-]+)/i);
  return match ? match[1] : '';
}

// --- Query Param Handler ---
async function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const user = urlParams.get('user');
  const playlist = urlParams.get('playlist');
  const exactUrl = urlParams.get('url');

  if (user && playlist) {
    console.log(`[Init] Loading profile @${user} and playlist ${playlist} concurrently`);
    
    // Show landing screen loader
    landingBtnText.classList.add('hidden');
    landingBtnLoader.classList.remove('hidden');
    landingBtn.disabled = true;

    try {
      // 1. Fetch profile first to populate sidebar
      const profileRes = await fetch(`/api/suno?url=${encodeURIComponent(`https://suno.com/@${user}`)}`);
      const profileData = await profileRes.json();

      if (!profileData.error) {
        userProfileData = profileData;
        
        // Set source details in workspace sidebar
        sourceName.textContent = profileData.name || 'Suno Catalog';
        sourceType.textContent = 'Artist Profile';
        
        if (profileData.tracks && profileData.tracks.length > 0 && profileData.tracks[0].image_url) {
          sourceCover.src = profileData.tracks[0].image_url;
        } else {
          sourceCover.src = 'https://cdn1.suno.ai/image_large_00000000-0000-0000-0000-000000000000.png';
        }

        // Populate user playlists
        if (profileData.playlists && profileData.playlists.length > 0) {
          playlistsSection.classList.remove('hidden');
          renderPlaylistsList(profileData.playlists);
        }
      }

      // 2. Fetch and load the playlist (passing isSubRequest = true to keep userProfileData)
      await importSunoUrl(`https://suno.com/playlist/${playlist}`, true);

    } catch (err) {
      console.error('[Init] Failed to load dual params:', err);
      // Fallback to loading playlist only
      importSunoUrl(`https://suno.com/playlist/${playlist}`);
    }
  } else if (playlist) {
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

  const plMatch = urlInput.match(/\/playlist\/([a-f0-9\-]{36})/i);
  const isPlaylistId = /^[a-f0-9\-]{36}$/i.test(urlInput);
  const activePlaylistId = plMatch ? plMatch[1] : (isPlaylistId ? urlInput : '');

  // If a parent profile is loaded, keep the user parameter!
  if (userProfileData) {
    const username = getUsernameFromUrl(userProfileData.url || userProfileData.name);
    if (username) {
      if (activePlaylistId) {
        shareParams = `?user=${username}&playlist=${activePlaylistId}`;
      } else {
        shareParams = `?user=${username}`;
      }
    }
  }

  // Fallback to single parameters
  if (!shareParams) {
    if (activePlaylistId) {
      shareParams = `?playlist=${activePlaylistId}`;
    } else if (urlInput.includes('/@')) {
      const userMatch = urlInput.match(/\/@([a-zA-Z0-9_\-]+)/i);
      if (userMatch) shareParams = `?user=${userMatch[1]}`;
      else shareParams = `?url=${encodeURIComponent(urlInput)}`;
    } else if (urlInput.startsWith('@')) {
      shareParams = `?user=${urlInput.replace('@', '')}`;
    } else {
      shareParams = `?url=${encodeURIComponent(urlInput)}`;
    }
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

// --- Recent History Storage & UI ---
function saveToHistory(type, id, name) {
  let history = { users: [], playlists: [], tracks: [] };
  try {
    const saved = localStorage.getItem('suno_player_history_v2');
    if (saved) history = JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load history:', e);
  }

  let list = [];
  if (type === 'profile' || type === 'user') {
    list = history.users;
  } else if (type === 'playlist') {
    list = history.playlists;
  } else {
    list = history.tracks;
  }

  const cleanId = id.trim();
  const cleanName = name || cleanId;

  // Remove existing duplicate
  const index = list.findIndex(item => item.id.toLowerCase() === cleanId.toLowerCase());
  if (index !== -1) {
    list.splice(index, 1);
  }

  // Push to front (newest first)
  list.unshift({ id: cleanId, name: cleanName });

  // Cap at 10 items
  if (list.length > 10) {
    list.length = 10;
  }

  try {
    localStorage.setItem('suno_player_history_v2', JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }

  renderHistoryUI();
}

function renderHistoryUI() {
  let history = { users: [], playlists: [], tracks: [] };
  try {
    const saved = localStorage.getItem('suno_player_history_v2');
    if (saved) history = JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load history:', e);
  }

  const container = document.getElementById('history-container');
  const usersList = document.getElementById('history-users-list');
  const playlistsList = document.getElementById('history-playlists-list');
  const tracksList = document.getElementById('history-tracks-list');

  const dropUsersList = document.getElementById('dropdown-history-users-list');
  const dropPlaylistsList = document.getElementById('dropdown-history-playlists-list');
  const dropTracksList = document.getElementById('dropdown-history-tracks-list');

  const hasHistory = history.users.length > 0 || history.playlists.length > 0 || history.tracks.length > 0;
  if (!hasHistory) {
    if (container) container.classList.add('hidden');
    return;
  }
  if (container) container.classList.remove('hidden');

  // Helper to render HTML list items
  const getListHtml = (items, type) => {
    if (items.length === 0) return '<div class="empty-history">履歴はありません</div>';
    return items.map(item => `
      <div class="history-item" data-url="${escapeHtml(item.id)}">
        <span class="history-item-title">${escapeHtml(item.name)}</span>
        <span class="history-item-sub">${escapeHtml(type === 'user' ? item.id : (item.id.length > 36 ? item.id.slice(0, 36) + '...' : item.id))}</span>
      </div>
    `).join('');
  };

  // Render Landing History
  if (usersList) usersList.innerHTML = getListHtml(history.users, 'user');
  if (playlistsList) playlistsList.innerHTML = getListHtml(history.playlists, 'playlist');
  if (tracksList) tracksList.innerHTML = getListHtml(history.tracks, 'track');

  // Render Dropdown History
  if (dropUsersList) dropUsersList.innerHTML = getListHtml(history.users, 'user');
  if (dropPlaylistsList) dropPlaylistsList.innerHTML = getListHtml(history.playlists, 'playlist');
  if (dropTracksList) dropTracksList.innerHTML = getListHtml(history.tracks, 'track');

  // Bind click listeners to all history items
  document.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url');
      landingInput.value = url;

      // Hide dropdown if clicked inside dropdown
      const dropdown = document.getElementById('header-history-dropdown');
      if (dropdown) dropdown.classList.add('hidden');

      importSunoUrl(url);
    });
  });
}
