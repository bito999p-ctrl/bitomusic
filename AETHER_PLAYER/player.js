function updateMediaSession(track) {
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: getNormalizedArtist(track.artist_name),
      album: 'AetherPlayer',
      artwork: [
        { src: track.image_url, sizes: '512x512', type: 'image/png' }
      ]
    });
  }
}
function setupMediaSessionActions() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrev();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });
    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audioPlayer) {
          audioPlayer.currentTime = details.seekTime;
        }
      });
    } catch (e) {
      console.warn('MediaSession seekto handler failed to register:', e);
    }
  }
}

function getNormalizedArtist(name) {
  if (!name) return 'Suno Artist';
  if (name.toLowerCase().includes('bito999') || name.toLowerCase() === 'bito') {
    return 'Bito';
  }
  return name;
}

// Version: 2.8.6 (Re-deployed to ensure complete file sync)
import { AetherEnhancer, analyzeAudioResonances } from './audio-engine.js?v=2.8.6';

// --- State Variables ---
let audioCtx = null;
let enhancer = null;
let analyser = null;
let sourceNode = null;
let masterGainNode = null;

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
let currentTrackPreFetchTriggered = false;
let isLoadingAnalysis = false;

// Background Analysis Coordination
let currentAnalysisId = 0;
let activeAbortController = null;
let currentAnalysisResult = null;
let currentAudioBuffer = null;
let isUserDraggingProgress = false;
let seekTimeout = null;

// --- DOM Elements ---
const landingScreen = document.getElementById('landing-screen');
const playerWorkspace = document.getElementById('player-workspace');
const landingInput = document.getElementById('landing-input');
const landingBtn = document.getElementById('landing-btn');
const landingBtnText = document.getElementById('landing-btn-text');
const landingBtnLoader = document.getElementById('landing-btn-loader');
const backToLandingBtn = document.getElementById('back-to-landing-btn');
const sidebarBackBtn = document.getElementById('sidebar-back-btn');
const sidebarToPlayerBtn = document.getElementById('sidebar-to-player-btn');
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
const mobileEnhancerToggle = document.getElementById('mobile-enhancer-toggle');
const mobileLyricsText = document.getElementById('mobile-lyrics-text');
const presetSelect = document.getElementById('preset-select');
const mobilePresetSelect = document.getElementById('mobile-preset-select');

// Like Buttons & Dropdown tabs
const likeBtn = document.getElementById('like-btn');
const sourceLikeBtn = document.getElementById('source-like-btn');
const dropTabHistory = document.getElementById('drop-tab-history');
const dropTabFavorites = document.getElementById('drop-tab-favorites');
const dropContentHistory = document.getElementById('drop-content-history');
const dropContentFavorites = document.getElementById('drop-content-favorites');

// Bottom Nav Tab Bar DOM references
const navBtnLibrary = document.getElementById('nav-btn-library');
const navBtnUtility = document.getElementById('nav-btn-utility');
const workspaceSidebar = document.querySelector('.workspace-sidebar');
const workspacePlayer = document.querySelector('.workspace-player');
const workspaceUtility = document.querySelector('.workspace-utility');
const openLyricsBtn = document.getElementById('open-lyrics-btn');
const closeLyricsBtn = document.getElementById('close-lyrics-btn');
const playerLyricsOverlay = document.getElementById('player-lyrics-overlay');
const openPlaylistBtn = document.getElementById('open-playlist-btn');
const closePlaylistBtn = document.getElementById('close-playlist-btn');
const playerPlaylistOverlay = document.getElementById('player-playlist-overlay');
const overlayTracksCount = document.getElementById('overlay-tracks-count');

// Mini Player & Close button DOM references
const miniPlayer = document.getElementById('mini-player');
const mobileNavBar = document.getElementById('mobile-nav-bar');
const miniArtwork = document.getElementById('mini-artwork');
const miniTitle = document.getElementById('mini-title');
const miniArtist = document.getElementById('mini-artist');
const miniPlayBtn = document.getElementById('mini-play-btn');
const miniNextBtn = document.getElementById('mini-next-btn');
const miniLikeBtn = document.getElementById('mini-like-btn');
const closePlayerBtn = document.getElementById('close-player-btn');
const mobileSourceLikeBtn = document.getElementById('mobile-source-like-btn');

// Global mock state required by favorites
let favorites = { users: [], playlists: [], tracks: [] };
let currentSource = { type: '', name: '', url: '' };
// Screen Wake Lock API helpers to prevent screen sleep during playback
let wakeLock = null;
let speakerPlayer = null;
let mediaStreamDest = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen wake lock acquired.');
    }
  } catch (err) {
    console.warn(`[WakeLock] Failed to acquire screen wake lock: ${err.message}`);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release()
      .then(() => {
        wakeLock = null;
        console.log('[WakeLock] Screen wake lock released.');
      })
      .catch((err) => console.error(err));
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  if (document.body) document.body.classList.remove('player-active'); // Ensure scroll is unlocked initially
  setupEventListeners();
  setupMediaSessionActions();
  
  // Default to OFF (low power) visualizer mode on mobile to prevent heating!
  if (window.innerWidth <= 768 && visModeSelect) {
    visModeSelect.value = 'off';
  }

  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
    handleResponsiveLayout();
  });
  
  // Render recent history and favorites on startup
  renderHistoryUI();
  renderFavoritesUI();
  
  // Align layout response on load
  handleResponsiveLayout();
  
  // Check URL query parameters for auto-import
  checkUrlParams();

  // Initialize Lucide Icons
  if (window.lucide) lucide.createIcons();
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

  // Setup Master Gain (for iOS volume control support)
  masterGainNode = audioCtx.createGain();
  masterGainNode.gain.setValueAtTime(volumeSlider ? volumeSlider.value / 100 : 0.8, audioCtx.currentTime);
  audioPlayer.volume = 1.0; // Keep media element at unity gain

  // Connect graph: Source -> Enhancer -> Analyser -> MasterGain -> MediaStreamDestination (for background audio support)
  sourceNode.connect(enhancer.inputNode);
  enhancer.outputNode.connect(analyser);
  analyser.connect(masterGainNode);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && 'createMediaStreamDestination' in audioCtx) {
    mediaStreamDest = audioCtx.createMediaStreamDestination();
    masterGainNode.connect(mediaStreamDest);
    
    // Create a speaker element to audibly play the mastered stream
    speakerPlayer = document.createElement('audio');
    speakerPlayer.id = 'speaker-player';
    speakerPlayer.preload = 'auto';
    speakerPlayer.srcObject = mediaStreamDest.stream;
    document.body.appendChild(speakerPlayer);
    console.log('[AudioEngine] MediaStreamDestination routing initialized for iOS background support.');
  } else {
    masterGainNode.connect(audioCtx.destination);
    console.log('[AudioEngine] Direct destination routing initialized.');
  }

  console.log('[AudioEngine] Web Audio graph initialized.');

  // Sync initial bypass check
  enhancer.setBypass(!enhancerToggle.checked);

  // Start visualizer animation loop
  startVisualizerLoop();
  // Start compressor GR meter loop
  setInterval(updateCompressionMeter, 100);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Landing screen actions
  if (landingBtn && landingInput) {
    landingBtn.addEventListener('click', () => importSunoUrl(landingInput.value));
    landingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') importSunoUrl(landingInput.value);
    });
  }

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
  if (sidebarBackBtn) {
    sidebarBackBtn.addEventListener('click', showLandingView);
  }
  if (sidebarToPlayerBtn) {
    sidebarToPlayerBtn.addEventListener('click', openPlayerModal);
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', copyShareLink);
  }

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

  // Like Buttons Click Event Listeners
  if (likeBtn) {
    likeBtn.addEventListener('click', toggleTrackLike);
  }
  if (sourceLikeBtn) {
    sourceLikeBtn.addEventListener('click', toggleSourceLike);
  }

  // Dropdown Tab Switchers
  if (dropTabHistory && dropTabFavorites) {
    dropTabHistory.addEventListener('click', () => switchDropdownTab('history'));
    dropTabFavorites.addEventListener('click', () => switchDropdownTab('favorites'));
  }

  // Mobile Bottom Navigation Tabs
  if (navBtnLibrary && navBtnUtility) {
    navBtnLibrary.addEventListener('click', () => switchMobileTab('library'));
    navBtnUtility.addEventListener('click', () => switchMobileTab('utility'));
  }

  // Mini Player event listeners on mobile
  if (miniPlayer) {
    miniPlayer.addEventListener('click', (e) => {
      // Do not trigger modal slide-up if user clicked play/next/like actions
      if (e.target.closest('button')) return;
      openPlayerModal();
    });
  }

  if (miniPlayBtn) {
    miniPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });
  }

  if (miniNextBtn) {
    miniNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playNext();
    });
  }

  if (miniLikeBtn) {
    miniLikeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTrackLike();
    });
  }

  if (closePlayerBtn) {
    closePlayerBtn.addEventListener('click', closePlayerModal);
  }

  // Player controls
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);
  if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
  if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);

  // Progress / Seek
  if (audioPlayer) {
    audioPlayer.addEventListener('timeupdate', updateProgressBar);
    audioPlayer.addEventListener('loadedmetadata', onTrackLoaded);
    audioPlayer.addEventListener('ended', onTrackEnded);
    audioPlayer.addEventListener('seeked', () => {
      if (seekTimeout) clearTimeout(seekTimeout);
      isUserDraggingProgress = false;
    });

    audioPlayer.addEventListener('pause', () => {
      isPlaying = false;
      if (playPauseBtn) playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
      if (miniPlayBtn) miniPlayBtn.innerHTML = '<i data-lucide="play"></i>';
      if (artworkWrapper) artworkWrapper.classList.remove('playing');
      releaseWakeLock();
      if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend();
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      if (speakerPlayer) {
        speakerPlayer.pause();
      }
      if (window.lucide) lucide.createIcons();
    });

    audioPlayer.addEventListener('play', () => {
      isPlaying = true;
      if (playPauseBtn) playPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
      if (miniPlayBtn) miniPlayBtn.innerHTML = '<i data-lucide="pause"></i>';
      if (artworkWrapper) artworkWrapper.classList.add('playing');
      requestWakeLock();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      startVisualizerLoop();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      if (speakerPlayer && speakerPlayer.paused) {
        speakerPlayer.play().catch(e => console.warn('[Audio] speakerPlayer play failed:', e.message));
      }
      if (window.lucide) lucide.createIcons();
    });
  }
  
  if (progressBar) {
    progressBar.addEventListener('input', () => {
      isUserDraggingProgress = true;
      const duration = getDuration();
      if (duration > 0) {
        const dragTime = (progressBar.value / 100) * duration;
        currentTimeEl.textContent = formatTime(dragTime);
      }
    });

    progressBar.addEventListener('change', () => {
      const duration = getDuration();
      if (duration > 0) {
        const seekTime = (progressBar.value / 100) * duration;
        if (audioPlayer) {
          audioPlayer.currentTime = seekTime;
        }
      }
      if (seekTimeout) clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        isUserDraggingProgress = false;
      }, 1000); // 1s fallback safety reset
    });
  }

  // Volume
  if (volumeSlider) {
    volumeSlider.addEventListener('input', updateVolume);
  }

  // Visualizer Mode
  if (visModeSelect) {
    visModeSelect.addEventListener('change', () => {
      if (visModeSelect.value !== 'off') {
        startVisualizerLoop();
      }
    });
  }

  // Tab switching
  if (tabEnhancerBtn) tabEnhancerBtn.addEventListener('click', () => switchTab('enhancer'));
  if (tabLyricsBtn) tabLyricsBtn.addEventListener('click', () => switchTab('lyrics'));

  // Enhancer Toggle (Bypass)
  if (enhancerToggle) {
    enhancerToggle.addEventListener('change', () => {
      initAudio();
      if (enhancer) {
        enhancer.setBypass(!enhancerToggle.checked);
      }
      if (mobileEnhancerToggle) {
        mobileEnhancerToggle.checked = enhancerToggle.checked;
      }
      updateAiStatus(enhancerToggle.checked ? 'active' : 'bypass');
    });
  }

  if (mobileEnhancerToggle) {
    mobileEnhancerToggle.addEventListener('change', () => {
      initAudio();
      if (enhancer) {
        enhancer.setBypass(!mobileEnhancerToggle.checked);
      }
      enhancerToggle.checked = mobileEnhancerToggle.checked;
      updateAiStatus(mobileEnhancerToggle.checked ? 'active' : 'bypass');
    });
  }

  // Lyrics Overlay controls
  if (openLyricsBtn && playerLyricsOverlay) {
    openLyricsBtn.addEventListener('click', () => {
      if (playerPlaylistOverlay) playerPlaylistOverlay.classList.remove('active-playlist');
      playerLyricsOverlay.classList.add('active-lyrics');
    });
  }
  if (closeLyricsBtn && playerLyricsOverlay) {
    closeLyricsBtn.addEventListener('click', () => {
      playerLyricsOverlay.classList.remove('active-lyrics');
    });
  }

  // Playlist Overlay controls
  if (openPlaylistBtn && playerPlaylistOverlay) {
    openPlaylistBtn.addEventListener('click', () => {
      if (playerLyricsOverlay) playerLyricsOverlay.classList.remove('active-lyrics');
      playerPlaylistOverlay.classList.add('active-playlist');
    });
  }
  if (closePlaylistBtn && playerPlaylistOverlay) {
    closePlaylistBtn.addEventListener('click', () => {
      playerPlaylistOverlay.classList.remove('active-playlist');
    });
  }

  // Genre Preset Selection
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      if (mobilePresetSelect) mobilePresetSelect.value = presetSelect.value;
      applySelectedPreset();
    });
  }
  if (mobilePresetSelect) {
    mobilePresetSelect.addEventListener('change', () => {
      if (presetSelect) presetSelect.value = mobilePresetSelect.value;
      applySelectedPreset();
    });
  }
}

// --- Import Suno Data & Screen Navigation ---
async function importSunoUrl(urlStr, isSubRequest = false) {
  if (!urlStr.trim()) return;

  // If a completely new main import, clear parent profile data
  if (!isSubRequest) {
    userProfileData = null;
  }

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
        userProfileData.url = urlStr; // Keep profile URL to allow going back and sharing correctly
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

    // Set source details in workspace sidebar
    sourceName.textContent = data.name || 'Suno Catalog';
    sourceType.textContent = data.type === 'profile' ? 'Artist Profile' : (data.type === 'song' ? 'Song' : 'Playlist');
    
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
    loadedUrl = data.url || urlStr.trim();

    // Render tracks list now that loadedUrl is set
    renderTracksList();

    // Save current active source for Favorites
    currentSource = {
      type: data.type,
      name: data.name || (data.type === 'profile' ? loadedUrl : 'Suno Item'),
      url: loadedUrl
    };
    updateSourceLikeButtonState();

    // Add to recent history (skip sub requests EXCEPT when it is a playlist!)
    if (!isSubRequest || data.type === 'playlist') {
      saveToHistory(data.type, loadedUrl, data.name || (data.type === 'profile' ? loadedUrl : 'Suno Item'));
    }

    // Update query parameters in the address bar dynamically
    updateAddressBar(loadedUrl);

    // Transition Screens: Hide landing, Show player
    landingScreen.classList.add('hidden');
    playerWorkspace.classList.remove('hidden');
    document.body.classList.add('player-active');
    resizeCanvas(); // Ensure canvas matches new dimensions

    // Set default active tab to library on mobile, and reveal mini-player
    if (window.innerWidth <= 768) {
      switchMobileTab('library');
      closePlayerModal();
    }
    updateMobileNavigationVisibility();

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

  // Hide mini player and close modal on landing screen
  if (miniPlayer) miniPlayer.classList.add('hidden');
  closePlayerModal();

  // Cancel any active analyses
  currentAnalysisId++;
  if (activeAbortController) {
    activeAbortController.abort();
  }

  // Clear cache & prefetch values
  analysisCache.clear();
  preFetchingUrl = '';
  userProfileData = null;
  currentAnalysisResult = null;
  if (presetSelect) presetSelect.value = 'auto';

  // Hide Suno link
  const sunoLink = document.getElementById('suno-link');
  if (sunoLink) {
    sunoLink.classList.add('hidden');
    sunoLink.href = '#';
  }

  // Clear query parameters from browser URL
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);

  // Clear lyrics
  if (lyricsText) lyricsText.textContent = '';
  if (mobileLyricsText) mobileLyricsText.textContent = '';

  // Transition Screens: Hide player, Show landing
  playerWorkspace.classList.add('hidden');
  landingScreen.classList.remove('hidden');
  document.body.classList.remove('player-active');

  // Refresh history UI
  renderHistoryUI();

  // Clear landing input
  landingInput.value = '';

  // Update navigation bar visibility
  updateMobileNavigationVisibility();
}

// --- Render Sidebar Items ---
function renderTracksList() {
  tracksList.innerHTML = '';
  
  const overlayList = document.getElementById('mobile-overlay-tracks-list');
  if (overlayList) {
    overlayList.innerHTML = '';
  }
  
  if (overlayTracksCount) {
    overlayTracksCount.textContent = tracks.length;
  }

  // If a sub-playlist is loaded but we have the parent profile in memory, render a return button!
  if (userProfileData && loadedUrl && !loadedUrl.includes('@') && !loadedUrl.includes('%40')) {
    const backBtn = document.createElement('div');
    backBtn.className = 'back-to-profile-item';
    backBtn.innerHTML = `
      <span class="back-icon"><i data-lucide="arrow-left" class="icon-inline"></i></span>
      <span class="back-text">${escapeHtml(userProfileData.name)} の公開曲に戻る</span>
    `;
    backBtn.addEventListener('click', restoreProfileView);
    tracksList.appendChild(backBtn);

    if (overlayList) {
      const cloneBackBtn = backBtn.cloneNode(true);
      cloneBackBtn.addEventListener('click', () => {
        restoreProfileView();
        if (playerPlaylistOverlay) {
          playerPlaylistOverlay.classList.remove('active-playlist');
        }
      });
      overlayList.appendChild(cloneBackBtn);
    }
  }
  
  if (tracks.length === 0) {
    const emptyHtml = '<div class="empty-list">曲が読み込まれていません</div>';
    tracksList.innerHTML = emptyHtml;
    if (overlayList) overlayList.innerHTML = emptyHtml;
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
        <div class="track-item-artist">${escapeHtml(getNormalizedArtist(track.artist_name))}</div>
      </div>
      <div class="track-item-playcount">
        <i data-lucide="flame" class="icon-inline" style="width:12px;height:12px;color:#ef4444;fill:#ef4444;margin-right:2px;"></i> ${formattedPlays}
      </div>
    `;

    item.addEventListener('click', () => selectTrack(idx));
    tracksList.appendChild(item);

    if (overlayList) {
      const cloneItem = item.cloneNode(true);
      cloneItem.addEventListener('click', () => {
        selectTrack(idx);
        if (playerPlaylistOverlay) {
          playerPlaylistOverlay.classList.remove('active-playlist');
        }
      });
      overlayList.appendChild(cloneItem);
    }
  });

  if (window.lucide) lucide.createIcons();
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

  // Restore currentSource and update Like icons
  currentSource = {
    type: 'profile',
    name: userProfileData.name,
    url: userProfileData.url
  };
  updateSourceLikeButtonState();

  // Update track count and limit warnings
  tracksCountEl.textContent = tracks.length;
  const limitWarning = document.getElementById('sidebar-limit-warning');
  if (limitWarning) {
    if (tracks.length === 20) {
      limitWarning.classList.remove('hidden');
    } else {
      limitWarning.classList.add('hidden');
    }
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
  currentTrackPreFetchTriggered = false;

  // On mobile, auto open full-screen player modal
  if (window.innerWidth <= 768) {
    openPlayerModal();
  }
  const track = tracks[idx];

  // Update track active class in list
  const items = tracksList.querySelectorAll('.track-item');
  items.forEach((item, i) => {
    if (i === idx) item.classList.add('active');
    else item.classList.remove('active');
  });

  const overlayList = document.getElementById('mobile-overlay-tracks-list');
  if (overlayList) {
    const overlayItems = overlayList.querySelectorAll('.track-item');
    overlayItems.forEach((item, i) => {
      if (i === idx) item.classList.add('active');
      else item.classList.remove('active');
    });
  }

  // Set Player UI metadata
  trackTitle.textContent = track.title;
  trackArtist.textContent = getNormalizedArtist(track.artist_name);
  trackArtwork.src = track.image_url;

  // Sync to Mini-Player UI
  if (miniTitle) miniTitle.textContent = track.title;
  if (miniArtist) miniArtist.textContent = getNormalizedArtist(track.artist_name);
  if (miniArtwork) miniArtwork.src = track.image_url;

  // Update Like button state for this track
  updateLikeButtonState(track.id);

  // Set Suno external link
  const sunoLink = document.getElementById('suno-link');
  if (sunoLink) {
    sunoLink.href = `https://suno.com/song/${track.id}`;
    sunoLink.classList.remove('hidden');
  }
  
  // Set Lyrics
  if (track.description) {
    lyricsText.textContent = track.description;
    if (mobileLyricsText) mobileLyricsText.textContent = track.description;
  } else {
    const emptyHtml = '<div class="empty-list">インスト曲または歌詞が見つかりません。</div>';
    lyricsText.innerHTML = emptyHtml;
    if (mobileLyricsText) mobileLyricsText.innerHTML = emptyHtml;
  }

  // Initialize Web Audio context and enhancer nodes if not done yet
  initAudio();

  // Stop current player first, ensuring no overlap
  audioPlayer.pause();
  audioPlayer.src = '';

  // Update Media Session Metadata
  updateMediaSession(track);

  // Trigger analysis or use cache
  currentAnalysisId++;
  const analysisId = currentAnalysisId;

  const cached = analysisCache.get(track.audio_url);
  if (cached) {
    console.log(`[AI Auto] Using pre-analyzed cache for: ${track.title}`);
    currentAnalysisResult = cached.result;
    currentAudioBuffer = cached.buffer;
    if (presetSelect) presetSelect.value = 'auto';
    if (mobilePresetSelect) mobilePresetSelect.value = 'auto';
    if (enhancer) {
      enhancer.setMasteringParams(currentAnalysisResult.suggestedParams, currentAnalysisResult.notches);
    }
    updateAiHudUI(currentAnalysisResult);
    updateAiStatus(enhancerToggle.checked ? 'active' : 'bypass');
    
    // Play immediately with correct parameters applied!
    startPlayback(track.audio_url);
  } else {
    isLoadingAnalysis = true; // Mark as loading to prevent ended events from silent WAV
    
    // Play a silent 1ms audio to instantly unlock the audio element under the user gesture (prevents mobile Safari autoplay block)
    audioPlayer.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    audioPlayer.play().catch(() => {});

    applyDefaultAutoParams();
    updateAiStatus('loading');

    // Show Loading loader UI in player and suspend play button until mastering is ready!
    playPauseBtn.disabled = true;
    playPauseBtn.style.opacity = '0.5';
    trackTitle.textContent = track.title;
    
    const analyzingIndicator = document.getElementById('ai-analyzing-indicator');
    if (analyzingIndicator) {
      analyzingIndicator.innerHTML = '<span class="pulse-dot"></span> AIマスタリング分析中...';
      analyzingIndicator.classList.remove('hidden');
    }

    // Run async analysis in background
    (async () => {
      try {
        if (activeAbortController) {
          activeAbortController.abort();
        }
        activeAbortController = new AbortController();

        console.log(`[AI Auto] Fetching audio for analysis: ${track.audio_url}`);
        let response;
        try {
          const directUrl = track.audio_url + (track.audio_url.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
          response = await fetch(directUrl, { signal: activeAbortController.signal });
          if (!response.ok) throw new Error(`Direct fetch status ${response.status}`);
        } catch (directErr) {
          console.warn('[AI Auto] Direct fetch failed, trying proxy:', directErr.message);
          const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(track.audio_url)}`;
          response = await fetch(proxyUrl, { signal: activeAbortController.signal });
          if (!response.ok) throw new Error(`Proxy fetch status ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        if (analysisId !== currentAnalysisId) return;

        updateAiStatus('analyzing');
        if (analyzingIndicator) {
          analyzingIndicator.innerHTML = '<span class="pulse-dot"></span> マスタリング分析中...';
        }

        console.log('[AI Auto] Decoding audio channel buffers...');
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (analysisId !== currentAnalysisId) return;

        console.log(`[AI Auto] Audio Decoded: Duration ${decodedBuffer.duration.toFixed(2)}s, SampleRate ${decodedBuffer.sampleRate}Hz, Channels ${decodedBuffer.numberOfChannels}, Bytes ${arrayBuffer.byteLength}`);
        console.log('[AI Auto] Running AetherMaster spectral resonance & dynamics analysis...');
        const result = analyzeAudioResonances(decodedBuffer, 'auto');
        console.log('[AI Auto] Analysis Result:', JSON.stringify(result.suggestedParams));
        if (analysisId !== currentAnalysisId) return;

        // Cache the result and buffer for instant replay/gapless next transitions
        analysisCache.set(track.audio_url, { result, buffer: decodedBuffer });

        currentAnalysisResult = result;
        currentAudioBuffer = decodedBuffer;
        if (presetSelect) presetSelect.value = 'auto';
        if (mobilePresetSelect) mobilePresetSelect.value = 'auto';

        // Apply mastering params dynamically to the running audio stream
        if (enhancer) {
          enhancer.setMasteringParams(result.suggestedParams, result.notches);
        }

        // Update AI HUD UI
        updateAiHudUI(result);
        updateAiStatus(enhancerToggle.checked ? 'active' : 'bypass');
        
        if (analyzingIndicator) {
          analyzingIndicator.classList.add('hidden');
        }

        // Enable UI buttons and start actual playback now!
        isLoadingAnalysis = false;
        playPauseBtn.disabled = false;
        playPauseBtn.style.opacity = '1';
        startPlayback(track.audio_url);

      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[AI Auto] Analysis aborted (track changed).');
          return;
        }
        console.error('[AI Auto] AI Analysis failed:', err);
        updateAiStatus('failed');
        if (analyzingIndicator) {
          analyzingIndicator.classList.add('hidden');
        }
        // Enable UI buttons and start playback as fallback (unmastered)
        isLoadingAnalysis = false;
        playPauseBtn.disabled = false;
        playPauseBtn.style.opacity = '1';
        startPlayback(track.audio_url);
      }
    })();
  }
}

// --- Update Volume Helper ---
function updateVolume() {
  const vol = volumeSlider ? volumeSlider.value / 100 : 0.8;
  if (masterGainNode && audioCtx) {
    masterGainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
  } else {
    if (audioPlayer) audioPlayer.volume = vol;
  }
}

// --- Start Track Playback ---
function startPlayback(url) {
  updateVolume();
  if (url.startsWith('http') && !url.includes('/api/proxy-audio')) {
    const directUrl = url + (url.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
    audioPlayer.src = directUrl;
    audioPlayer.play()
      .catch(err => {
        console.warn('[Playback] Direct play failed, trying proxy:', err.message);
        const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
        audioPlayer.src = proxyUrl;
        audioPlayer.play().catch(pErr => {
          console.error('[Playback] Proxy playback failed completely:', pErr.message);
        });
      });
  } else {
    audioPlayer.src = url;
    audioPlayer.play().catch(err => {
      console.error('[Playback] Playback failed:', err.message);
    });
  }
}

// --- Pre-fetch & Pre-analyze Background workers ---
async function runPreAnalysis(track) {
  const url = track.audio_url;
  try {
    initAudio();
    let response;
    try {
      const directUrl = url + (url.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
      response = await fetch(directUrl);
      if (!response.ok) throw new Error(`Direct status ${response.status}`);
    } catch (directErr) {
      console.warn('[Pre-Fetch] Direct fetch failed, trying proxy:', directErr.message);
      const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
      response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy status ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    console.log(`[Pre-Fetch] Audio Decoded for ${track.title}: Duration ${decodedBuffer.duration.toFixed(2)}s, SampleRate ${decodedBuffer.sampleRate}Hz, Bytes ${arrayBuffer.byteLength}`);
    const result = analyzeAudioResonances(decodedBuffer, 'auto');
    console.log(`[Pre-Fetch] Pre-Analysis Result for ${track.title}:`, JSON.stringify(result.suggestedParams));
    
    analysisCache.set(url, { result, buffer: decodedBuffer });
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
  if (currentTrackPreFetchTriggered) return;
  const duration = getDuration();
  if (duration === 0 || audioPlayer.paused) return;

  const timeLeft = duration - audioPlayer.currentTime;
  // Trigger pre-fetch when less than 20 seconds remain or progress is > 85%
  if (timeLeft < 20 || (audioPlayer.currentTime / duration) > 0.85) {
    currentTrackPreFetchTriggered = true;
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
  if (status === 'loading') {
    aiStatusEl.textContent = 'LOADING...';
  } else if (status === 'analyzing') {
    aiStatusEl.textContent = 'ANALYZING...';
  } else if (status === 'active') {
    aiStatusEl.textContent = 'ACTIVE';
  } else if (status === 'bypass') {
    aiStatusEl.textContent = 'BYPASS';
  } else if (status === 'failed') {
    aiStatusEl.textContent = 'FAILED (STD)';
  } else {
    aiStatusEl.textContent = 'STANDBY';
  }
}

function applySelectedPreset() {
  if (!enhancer || !currentAudioBuffer) return;

  const presetKey = presetSelect ? presetSelect.value : 'auto';

  // Run the spectral resonance & dynamics analysis using the current audio buffer and the selected preset!
  const result = analyzeAudioResonances(currentAudioBuffer, presetKey);
  currentAnalysisResult = result;

  // Apply mastering parameters to the enhancer stage
  enhancer.setMasteringParams(result.suggestedParams, result.notches);

  // Update HUD elements
  updateAiHudUI(result);
}

function updateAiHudUI(result) {
  const sug = result.suggestedParams;

  // EQ, Width, Hiss
  hudEqLowEl.textContent = `${sug.eqLowGain > 0 ? '+' : ''}${sug.eqLowGain.toFixed(1)} dB`;
  hudEqHighEl.textContent = `${sug.eqHighGain > 0 ? '+' : ''}${sug.eqHighGain.toFixed(1)} dB`;
  hudWidthEl.textContent = `${sug.stereoWidth.toFixed(2)}x`;
  
  const hissAmount = sug.hissReductionAmount || 0;
  const ceilFreq = 20000.0 - (7000.0 * (hissAmount / 100.0));
  hudHissEl.textContent = `${hissAmount}% (${Math.round(ceilFreq)}Hz)`;

  // Dynamics
  hudCompThreshEl.textContent = `${sug.compThreshold.toFixed(1)} dB`;
  hudCompRatioEl.textContent = `${sug.compRatio.toFixed(2)}:1`;
  hudLimiterBoostEl.textContent = `+${sug.limiterBoost.toFixed(1)} dB`;

  // Dynamic Range, Stereo Field, and Detected Genre Style Descriptors
  const dynamicsDesc = document.getElementById('hud-dynamics-desc');
  const stereoDesc = document.getElementById('hud-stereo-desc');
  const genreDesc = document.getElementById('hud-genre-desc');

  if (dynamicsDesc) dynamicsDesc.textContent = result.crestDesc || 'Normal (Balanced)';
  if (stereoDesc) stereoDesc.textContent = result.correlationDesc || 'Balanced Stereo';
  
  const selectedPreset = (presetSelect ? presetSelect.value : 'auto');
  let styleText = 'OPTIMIZED';
  if (selectedPreset === 'custom') {
    styleText = 'MANUAL CUSTOM';
  } else if (selectedPreset !== 'auto') {
    styleText = selectedPreset.toUpperCase();
  }
  if (genreDesc) genreDesc.textContent = styleText;

  // Notch Filters
  notchesListEl.innerHTML = '';
  if (result.notches && result.notches.length > 0) {
    result.notches.forEach((notch, idx) => {
      const el = document.createElement('div');
      el.className = 'notch-item';
      const peakType = notch.isBroad ? "Hump" : "Whistle";
      const qVal = notch.q ? notch.q.toFixed(1) : "15.0";
      el.innerHTML = `
        <span>#${idx + 1} ${notch.freq}Hz [${peakType}]</span>
        <span>${notch.cut.toFixed(1)}dB (Q=${qVal})</span>
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
    satType: 'tube',
    satDrive: 12,
    satMix: 10,
    eqLowGain: 0.0,
    eqLowFreq: 90,
    eqMidGain: 0.0,
    eqMidFreq: 1000,
    eqMidQ: 1.0,
    eqHighGain: 0.0,
    eqHighFreq: 9000,
    compEnabled: true,
    compThreshold: -8.0,
    compRatio: 1.35,
    compAttack: 0.04,
    compRelease: 0.20,
    stereoWidth: 1.15,
    sideHighPassFreq: 110,
    limiterBoost: 3.5,
    rumbleCutEnabled: false,
    hissReductionAmount: 0
  };
  
  if (enhancer) {
    enhancer.setMasteringParams(defaultParams, []);
  }

  const analyzingIndicator = document.getElementById('ai-analyzing-indicator');
  if (analyzingIndicator) {
    analyzingIndicator.classList.add('hidden');
  }

  // Set default HUD display values to match auto preset
  hudEqLowEl.textContent = '0.0 dB';
  hudEqHighEl.textContent = '0.0 dB';
  hudWidthEl.textContent = '1.15x';
  hudHissEl.textContent = '0%';
  hudCompThreshEl.textContent = '-8.0 dB';
  hudCompRatioEl.textContent = '1.35:1';
  hudLimiterBoostEl.textContent = '+3.5 dB';
  notchesListEl.innerHTML = '<div class="empty-notches">分析待ち...</div>';

  const dynamicsDesc = document.getElementById('hud-dynamics-desc');
  const stereoDesc = document.getElementById('hud-stereo-desc');
  const genreDesc = document.getElementById('hud-genre-desc');
  if (dynamicsDesc) dynamicsDesc.textContent = '--';
  if (stereoDesc) stereoDesc.textContent = '--';
  if (genreDesc) genreDesc.textContent = '--';

  if (likeBtn) likeBtn.classList.remove('liked');
}

// --- Player Controls Trigger Helpers ---
function togglePlay() {
  if (tracks.length === 0) return;

  initAudio();
  if (isPlaying) {
    audioPlayer.pause();
  } else {
    if (currentTrackIndex === -1) {
      selectTrack(0);
      return;
    }
    audioPlayer.play();
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
    repeatBtn.innerHTML = '<i data-lucide="repeat-1"></i>';
    repeatBtn.style.opacity = '1';
  } else if (repeatMode === 'one') {
    repeatMode = 'none';
    repeatBtn.classList.remove('active');
    repeatBtn.innerHTML = '<i data-lucide="repeat"></i>';
    repeatBtn.style.opacity = '0.4';
  } else {
    repeatMode = 'all';
    repeatBtn.classList.add('active');
    repeatBtn.innerHTML = '<i data-lucide="repeat"></i>';
    repeatBtn.style.opacity = '1';
  }
  if (window.lucide) lucide.createIcons();
}

function onTrackEnded() {
  if (isLoadingAnalysis) {
    console.log('[Playback] Silent WAV ended during loading, ignoring event.');
    return;
  }
  if (repeatMode === 'one') {
    audioPlayer.currentTime = 0;
    audioPlayer.play();
  } else if (repeatMode === 'all' || isShuffle) {
    playNext();
  } else {
    if (currentTrackIndex < tracks.length - 1) {
      playNext();
    } else {
      audioPlayer.pause();
    }
  }
}

function getDuration() {
  if (currentAudioBuffer && isFinite(currentAudioBuffer.duration) && currentAudioBuffer.duration > 0) {
    return currentAudioBuffer.duration;
  }
  if (audioPlayer && isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
    return audioPlayer.duration;
  }
  return 0;
}

// --- Seek & Loader Meta ---
function onTrackLoaded() {
  progressBar.value = 0;
  currentTimeEl.textContent = '0:00';
  durationTimeEl.textContent = formatTime(getDuration());
}

function updateProgressBar() {
  if (isUserDraggingProgress || (audioPlayer && audioPlayer.seeking)) return;

  const duration = getDuration();
  if (duration > 0) {
    const percentage = (audioPlayer.currentTime / duration) * 100;
    progressBar.value = percentage;
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);

    // Check and trigger pre-fetching in the background
    checkAndPreFetchNextTrack();
  }
}

// --- Compressor Gain Reduction Meter ---
function updateCompressionMeter() {
  if (!isPlaying || !enhancer || !enhancerToggle.checked || enhancer.isBypassed) {
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
  if (canvas && canvas.parentElement) {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (height < 2) return;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

let isVisualizerRunning = false;
function startVisualizerLoop() {
  if (!isVisualizerRunning && analyser) {
    isVisualizerRunning = true;
    requestAnimationFrame(drawVisualizer);
  }
}

function drawVisualizer() {
  if (!analyser || !canvas || !canvasCtx || !visModeSelect) {
    isVisualizerRunning = false;
    return;
  }

  const mode = visModeSelect.value;
  if (mode === 'off' || audioPlayer.paused || audioPlayer.ended) {
    isVisualizerRunning = false;
    // Clear canvas once to save energy
    const width = canvas.width;
    const height = canvas.height;
    canvasCtx.clearRect(0, 0, width, height);
    return;
  }

  isVisualizerRunning = true;
  requestAnimationFrame(drawVisualizer);

  const width = canvas.width;
  const height = canvas.height;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const isMobile = window.innerWidth <= 768;

  if (mode === 'oscilloscope') {
    analyser.getByteTimeDomainData(dataArray);
  } else {
    analyser.getByteFrequencyData(dataArray);
  }

  canvasCtx.clearRect(0, 0, width, height);

  if (mode === 'pulse-ring') {
    const centerX = width / 2;
    const centerY = height / 2;
    const minSize = Math.min(width, height);
    
    // Use a fixed base radius relative to the canvas minSize to keep it 100% static and avoid layout reflows/jitter
    const baseRadius = minSize * 0.31;
    const maxSpikeLength = minSize * 0.22; // Make spikes longer and more dynamic!

    // Glowing circle (Vibrant Cyan Glow) - Fixed at the artwork boundary
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
    canvasCtx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
    canvasCtx.lineWidth = Math.max(2.5, minSize * 0.015);
    if (!isMobile) {
      canvasCtx.shadowBlur = 18;
      canvasCtx.shadowColor = '#00f2fe';
    }
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;

    // Spikes (Cyan to Blue neon gradient)
    const spikeCount = 120; // Denser and cooler!
    const step = (2 * Math.PI) / spikeCount;
    
    for (let i = 0; i < spikeCount; i++) {
      const dataIdx = Math.floor((i / spikeCount) * (bufferLength / 2));
      const val = dataArray[dataIdx] || 0;
      const spikeLength = (val / 255.0) * maxSpikeLength;
      
      const angle = i * step;
      const startX = centerX + Math.cos(angle) * baseRadius;
      const startY = centerY + Math.sin(angle) * baseRadius;
      const endX = centerX + Math.cos(angle) * (baseRadius + spikeLength);
      const endY = centerY + Math.sin(angle) * (baseRadius + spikeLength);
      
      const grad = canvasCtx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, '#00f2fe');
      grad.addColorStop(1, '#4facfe');

      canvasCtx.beginPath();
      canvasCtx.moveTo(startX, startY);
      canvasCtx.lineTo(endX, endY);
      canvasCtx.strokeStyle = grad;
      canvasCtx.lineWidth = Math.max(2, minSize * 0.008);
      if (!isMobile) {
        canvasCtx.shadowBlur = 6;
        canvasCtx.shadowColor = '#00f2fe';
      }
      canvasCtx.stroke();
      canvasCtx.shadowBlur = 0;
    }

  } else if (mode === 'bars') {
    const barCount = 48; // Clean, professional number of thicker rounded bars
    const barWidth = (width / barCount);
    const spacing = Math.max(2, barWidth * 0.15);
    const activeBarWidth = barWidth - spacing;
    
    // Group the dataArray frequencies into barCount groups
    const groupSize = Math.floor(bufferLength / 2 / barCount);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        sum += dataArray[i * groupSize + j] || 0;
      }
      const val = sum / groupSize;
      const barHeight = (val / 255.0) * (height * 0.75); // Taller and more dynamic

      const x = i * barWidth + spacing / 2;
      const y = height - barHeight;

      const grad = canvasCtx.createLinearGradient(x, height, x, y);
      grad.addColorStop(0, '#00f2fe');
      grad.addColorStop(1, '#4facfe');

      canvasCtx.fillStyle = grad;
      if (!isMobile) {
        canvasCtx.shadowBlur = 4;
        canvasCtx.shadowColor = '#00f2fe';
      }
      drawRoundedRect(canvasCtx, x, y, activeBarWidth, barHeight, 4);
      canvasCtx.shadowBlur = 0;
    }

  } else if (mode === 'oscilloscope') {
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = '#00f2fe';
    if (!isMobile) {
      canvasCtx.shadowBlur = 12;
      canvasCtx.shadowColor = '#00f2fe';
    }
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
  if (!urlInput || typeof urlInput !== 'string') return;
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
  if (isNaN(seconds) || !isFinite(seconds) || seconds === null) return '0:00';
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

// --- Mobile Tab Navigation (SPA) ---
function switchMobileTab(tabName) {
  if (!workspaceSidebar || !workspacePlayer || !workspaceUtility) return;

  // Reset active classes
  workspaceSidebar.classList.add('mobile-hidden');
  workspaceUtility.classList.add('mobile-hidden');

  navBtnLibrary.classList.remove('active');
  navBtnUtility.classList.remove('active');

  if (tabName === 'library') {
    workspaceSidebar.classList.remove('mobile-hidden');
    navBtnLibrary.classList.add('active');
  } else if (tabName === 'utility') {
    workspaceUtility.classList.remove('mobile-hidden');
    navBtnUtility.classList.add('active');
  }
}

// --- Mobile Full-Screen Player Modal controls ---
function openPlayerModal() {
  if (workspacePlayer) {
    workspacePlayer.classList.add('active-modal');
  }
}

function closePlayerModal() {
  if (workspacePlayer) {
    workspacePlayer.classList.remove('active-modal');
  }
  if (playerLyricsOverlay) {
    playerLyricsOverlay.classList.remove('active-lyrics');
  }
  if (playerPlaylistOverlay) {
    playerPlaylistOverlay.classList.remove('active-playlist');
  }
}

function handleResponsiveLayout() {
  if (window.innerWidth > 768) {
    if (workspaceSidebar) workspaceSidebar.classList.remove('mobile-hidden');
    if (workspacePlayer) workspacePlayer.classList.remove('mobile-hidden');
    if (workspaceUtility) workspaceUtility.classList.remove('mobile-hidden');
    closePlayerModal(); // Ensure modal styles don't affect desktop columns
  } else {
    // If on mobile, make sure the active nav tab is shown, default to library
    const activeBtn = document.querySelector('.mobile-nav-bar .nav-btn.active');
    const activeTab = activeBtn ? activeBtn.id.replace('nav-btn-', '') : 'library';
    switchMobileTab(activeTab);
  }
  updateMobileNavigationVisibility();
}

function updateMobileNavigationVisibility() {
  const isMobile = window.innerWidth <= 768;
  const isLandingActive = !landingScreen.classList.contains('hidden');

  if (isMobile) {
    if (isLandingActive) {
      if (mobileNavBar) mobileNavBar.classList.add('hidden');
      if (miniPlayer) miniPlayer.classList.add('hidden');
    } else {
      if (mobileNavBar) mobileNavBar.classList.remove('hidden');
      // Only show mini player if tracks are loaded
      if (miniPlayer && tracks.length > 0) miniPlayer.classList.remove('hidden');
    }
  } else {
    // Desktop: make sure hidden states are removed if window resized
    if (mobileNavBar) mobileNavBar.classList.remove('hidden');
    if (miniPlayer) miniPlayer.classList.add('hidden');
  }
}

// --- Recent History Storage & UI ---
// --- Dropdown Tab Switching ---
function switchDropdownTab(tab) {
  if (tab === 'history') {
    dropTabHistory.classList.add('active');
    dropTabFavorites.classList.remove('active');
    dropContentHistory.classList.remove('hidden');
    dropContentFavorites.classList.add('hidden');
  } else {
    dropTabHistory.classList.remove('active');
    dropTabFavorites.classList.add('active');
    dropContentHistory.classList.add('hidden');
    dropContentFavorites.classList.remove('hidden');
  }
}

function canonicalizeSunoUrl(val) {
  if (!val || typeof val !== 'string') return '';
  let str = val.trim();
  if (str.startsWith('@')) {
    return `https://suno.com/${str}`;
  }
  if (/^[a-f0-9\-]{36}$/i.test(str)) {
    return `https://suno.com/playlist/${str}`;
  }
  if (!str.startsWith('http://') && !str.startsWith('https://') && !str.includes('/') && !str.includes('.')) {
    return `https://suno.com/@${str}`;
  }
  return str;
}

function getDisplaySubtitle(idOrUrl, type, item) {
  if (type === 'track') {
    return getNormalizedArtist(item.artist_name);
  }
  if (type === 'user' || type === 'profile') {
    const str = idOrUrl || '';
    const match = str.match(/suno\.com\/@([a-zA-Z0-9_\-]+)/i);
    if (match) return `@${match[1]}`;
    if (str.startsWith('@')) return str;
    return `@${str}`;
  }
  const str = idOrUrl || '';
  if (str.startsWith('http')) {
    const match = str.match(/playlist\/([a-f0-9\-]{36})/i);
    if (match) return match[1];
  }
  return str;
}

// --- Favorites (お気に入り) LocalStorage Management ---
function loadFavorites() {
  try {
    const saved = localStorage.getItem('suno_player_favorites_v2');
    if (saved) favorites = JSON.parse(saved);
    else favorites = { users: [], playlists: [], tracks: [] };

    // Migrate, canonicalize, and deduplicate
    let migrated = false;
    if (favorites.users) {
      favorites.users = favorites.users.map(u => {
        const canonical = canonicalizeSunoUrl(u.url || u.id);
        if (u.url !== canonical || u.id !== canonical) {
          migrated = true;
          u.url = canonical;
          u.id = canonical;
        }
        return u;
      });
      const uniqueUsers = [];
      const seenUrls = new Set();
      const seenNames = new Set();
      favorites.users.forEach(u => {
        if (!u) return;
        const urlKey = (u.url || u.id || '').toLowerCase();
        const nameKey = (u.name || '').trim().toLowerCase();
        if (!seenUrls.has(urlKey) && (!nameKey || !seenNames.has(nameKey))) {
          seenUrls.add(urlKey);
          if (nameKey) seenNames.add(nameKey);
          uniqueUsers.push(u);
        } else {
          migrated = true;
        }
      });
      favorites.users = uniqueUsers;
    }
    if (favorites.playlists) {
      favorites.playlists = favorites.playlists.map(p => {
        const canonical = canonicalizeSunoUrl(p.url || p.id);
        if (p.url !== canonical || p.id !== canonical) {
          migrated = true;
          p.url = canonical;
          p.id = canonical;
        }
        return p;
      });
      const uniquePlaylists = [];
      const seenUrls = new Set();
      const seenNames = new Set();
      favorites.playlists.forEach(p => {
        if (!p) return;
        const urlKey = (p.url || p.id || '').toLowerCase();
        const nameKey = (p.name || '').trim().toLowerCase();
        if (!seenUrls.has(urlKey) && (!nameKey || !seenNames.has(nameKey))) {
          seenUrls.add(urlKey);
          if (nameKey) seenNames.add(nameKey);
          uniquePlaylists.push(p);
        } else {
          migrated = true;
        }
      });
      favorites.playlists = uniquePlaylists;
    }
    if (migrated) {
      localStorage.setItem('suno_player_favorites_v2', JSON.stringify(favorites));
    }
  } catch (e) {
    console.error('Failed to load favorites:', e);
  }
}

function saveFavorites() {
  try {
    localStorage.setItem('suno_player_favorites_v2', JSON.stringify(favorites));
    renderFavoritesUI();
  } catch (e) {
    console.error('Failed to save favorites:', e);
  }
}

function toggleTrackLike() {
  if (currentTrackIndex === -1 || !tracks[currentTrackIndex]) return;
  const track = tracks[currentTrackIndex];
  loadFavorites();
  
  const idx = favorites.tracks.findIndex(t => t.id === track.id);
  if (idx === -1) {
    // Save full song URL as the import target
    const songUrl = `https://suno.com/song/${track.id}`;
    favorites.tracks.unshift({
      id: track.id,
      title: track.title,
      artist_name: getNormalizedArtist(track.artist_name),
      image_url: track.image_url,
      play_count: track.play_count,
      url: songUrl
    });
    if (likeBtn) likeBtn.classList.add('liked');
    if (miniLikeBtn) miniLikeBtn.classList.add('liked');
  } else {
    favorites.tracks.splice(idx, 1);
    if (likeBtn) likeBtn.classList.remove('liked');
    if (miniLikeBtn) miniLikeBtn.classList.remove('liked');
  }
  saveFavorites();
}

function toggleSourceLike() {
  if (!currentSource || !currentSource.type || !currentSource.url) return;
  loadFavorites();
  
  const list = currentSource.type === 'profile' ? favorites.users : favorites.playlists;
  const idx = list.findIndex(item => 
    item && (
      (item.url && item.url.toLowerCase() === currentSource.url.toLowerCase()) ||
      (item.name && item.name.trim().toLowerCase() === currentSource.name.trim().toLowerCase())
    )
  );
  
  let isLikedNow = false;
  if (idx === -1) {
    list.unshift({
      id: currentSource.url, // URL acts as the ID to import it later
      name: currentSource.name,
      url: currentSource.url
    });
    isLikedNow = true;
  } else {
    list.splice(idx, 1);
    isLikedNow = false;
  }
  
  if (sourceLikeBtn) {
    if (isLikedNow) sourceLikeBtn.classList.add('liked');
    else sourceLikeBtn.classList.remove('liked');
  }
  if (mobileSourceLikeBtn) {
    if (isLikedNow) mobileSourceLikeBtn.classList.add('liked');
    else mobileSourceLikeBtn.classList.remove('liked');
  }
  
  saveFavorites();
}

function updateLikeButtonState(trackId) {
  loadFavorites();
  const isLiked = favorites.tracks.some(t => t.id === trackId);
  if (likeBtn) {
    if (isLiked) likeBtn.classList.add('liked');
    else likeBtn.classList.remove('liked');
  }
  if (miniLikeBtn) {
    if (isLiked) miniLikeBtn.classList.add('liked');
    else miniLikeBtn.classList.remove('liked');
  }
}

function updateSourceLikeButtonState() {
  if (!currentSource || !currentSource.type || !currentSource.url) {
    if (sourceLikeBtn) sourceLikeBtn.classList.add('hidden');
    if (mobileSourceLikeBtn) mobileSourceLikeBtn.classList.add('hidden');
    return;
  }
  if (sourceLikeBtn) sourceLikeBtn.classList.remove('hidden');
  if (mobileSourceLikeBtn) mobileSourceLikeBtn.classList.remove('hidden');
  loadFavorites();
  
  const list = currentSource.type === 'profile' ? favorites.users : favorites.playlists;
  const isLiked = list.some(item => 
    item && (
      (item.url && item.url.toLowerCase() === currentSource.url.toLowerCase()) ||
      (item.name && item.name.trim().toLowerCase() === currentSource.name.trim().toLowerCase())
    )
  );
  
  if (sourceLikeBtn) {
    if (isLiked) sourceLikeBtn.classList.add('liked');
    else sourceLikeBtn.classList.remove('liked');
  }
  if (mobileSourceLikeBtn) {
    if (isLiked) mobileSourceLikeBtn.classList.add('liked');
    else mobileSourceLikeBtn.classList.remove('liked');
  }
}

function renderFavoritesUI() {
  loadFavorites();

  const container = document.getElementById('favorites-container');
  const usersList = document.getElementById('favorites-users-list');
  const playlistsList = document.getElementById('favorites-playlists-list');
  const tracksList = document.getElementById('favorites-tracks-list');

  const dropUsersList = document.getElementById('dropdown-favorites-users-list');
  const dropPlaylistsList = document.getElementById('dropdown-favorites-playlists-list');
  const dropTracksList = document.getElementById('dropdown-favorites-tracks-list');

  const hasFavorites = favorites.users.length > 0 || favorites.playlists.length > 0 || favorites.tracks.length > 0;
  if (!hasFavorites) {
    if (container) container.classList.add('hidden');
    if (dropUsersList) dropUsersList.innerHTML = '<div class="empty-history">お気に入りはありません</div>';
    if (dropPlaylistsList) dropPlaylistsList.innerHTML = '<div class="empty-history">お気に入りはありません</div>';
    if (dropTracksList) dropTracksList.innerHTML = '<div class="empty-history">お気に入りはありません</div>';
    return;
  }
  if (container) container.classList.remove('hidden');

  // Helper to render HTML list items
  const getListHtml = (items, type) => {
    if (items.length === 0) return '<div class="empty-history">お気に入りはありません</div>';
    return items.map(item => `
      <div class="favorite-item" data-url="${escapeHtml(item.url || item.id)}">
        <span class="favorite-item-title">${escapeHtml(item.name || item.title)}</span>
        <span class="favorite-item-sub">${escapeHtml(getDisplaySubtitle(item.url || item.id, type, item))}</span>
      </div>
    `).join('');
  };

  // Render Landing Favorites
  if (usersList) usersList.innerHTML = getListHtml(favorites.users, 'user');
  if (playlistsList) playlistsList.innerHTML = getListHtml(favorites.playlists, 'playlist');
  if (tracksList) tracksList.innerHTML = getListHtml(favorites.tracks, 'track');

  // Render Dropdown Favorites
  if (dropUsersList) dropUsersList.innerHTML = getListHtml(favorites.users, 'user');
  if (dropPlaylistsList) dropPlaylistsList.innerHTML = getListHtml(favorites.playlists, 'playlist');
  if (dropTracksList) dropTracksList.innerHTML = getListHtml(favorites.tracks, 'track');

  // Bind click listeners to all favorite items
  document.querySelectorAll('.favorite-item').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url');
      landingInput.value = url;

      // Hide dropdown if clicked inside dropdown
      const dropdown = document.getElementById('header-history-dropdown');
      if (dropdown) dropdown.classList.add('hidden');

      importSunoUrl(url);
    });
  });

  if (window.lucide) lucide.createIcons();
}

function saveToHistory(type, id, name) {
  let history = { users: [], playlists: [], tracks: [] };
  try {
    const saved = localStorage.getItem('suno_player_history_v2');
    if (saved) history = JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load history:', e);
  }

  // Migrate, canonicalize, and deduplicate existing history
  let migrated = false;
  if (history.users) {
    history.users = history.users.map(u => {
      const canonical = canonicalizeSunoUrl(u.id);
      if (u.id !== canonical) {
        migrated = true;
        u.id = canonical;
      }
      return u;
    });
    const uniqueUsers = [];
    const seenIds = new Set();
    const seenNames = new Set();
    history.users.forEach(u => {
      if (!u) return;
      const idKey = (u.id || '').toLowerCase();
      const nameKey = (u.name || '').trim().toLowerCase();
      if (!seenIds.has(idKey) && (!nameKey || !seenNames.has(nameKey))) {
        seenIds.add(idKey);
        if (nameKey) seenNames.add(nameKey);
        uniqueUsers.push(u);
      } else {
        migrated = true;
      }
    });
    history.users = uniqueUsers;
  }
  if (history.playlists) {
    history.playlists = history.playlists.map(p => {
      const canonical = canonicalizeSunoUrl(p.id);
      if (p.id !== canonical) {
        migrated = true;
        p.id = canonical;
      }
      return p;
    });
    const uniquePlaylists = [];
    const seenIds = new Set();
    const seenNames = new Set();
    history.playlists.forEach(p => {
      if (!p) return;
      const idKey = (p.id || '').toLowerCase();
      const nameKey = (p.name || '').trim().toLowerCase();
      if (!seenIds.has(idKey) && (!nameKey || !seenNames.has(nameKey))) {
        seenIds.add(idKey);
        if (nameKey) seenNames.add(nameKey);
        uniquePlaylists.push(p);
      } else {
        migrated = true;
      }
    });
    history.playlists = uniquePlaylists;
  }

  let list = [];
  if (type === 'profile' || type === 'user') {
    list = history.users;
  } else if (type === 'playlist') {
    list = history.playlists;
  } else {
    list = history.tracks;
  }

  const cleanId = canonicalizeSunoUrl(id.trim());
  const cleanName = name || cleanId;

  // Remove existing duplicate
  const index = list.findIndex(item => 
    item && (
      (item.id && item.id.toLowerCase() === cleanId.toLowerCase()) ||
      (item.name && item.name.trim().toLowerCase() === cleanName.trim().toLowerCase())
    )
  );
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

  // Migrate, canonicalize, and deduplicate on render
  let migrated = false;
  if (history.users) {
    history.users = history.users.map(u => {
      const canonical = canonicalizeSunoUrl(u.id);
      if (u.id !== canonical) {
        migrated = true;
        u.id = canonical;
      }
      return u;
    });
    const uniqueUsers = [];
    const seenIds = new Set();
    const seenNames = new Set();
    history.users.forEach(u => {
      if (!u) return;
      const idKey = (u.id || '').toLowerCase();
      const nameKey = (u.name || '').trim().toLowerCase();
      if (!seenIds.has(idKey) && (!nameKey || !seenNames.has(nameKey))) {
        seenIds.add(idKey);
        if (nameKey) seenNames.add(nameKey);
        uniqueUsers.push(u);
      } else {
        migrated = true;
      }
    });
    history.users = uniqueUsers;
  }
  if (history.playlists) {
    history.playlists = history.playlists.map(p => {
      const canonical = canonicalizeSunoUrl(p.id);
      if (p.id !== canonical) {
        migrated = true;
        p.id = canonical;
      }
      return p;
    });
    const uniquePlaylists = [];
    const seenIds = new Set();
    const seenNames = new Set();
    history.playlists.forEach(p => {
      if (!p) return;
      const idKey = (p.id || '').toLowerCase();
      const nameKey = (p.name || '').trim().toLowerCase();
      if (!seenIds.has(idKey) && (!nameKey || !seenNames.has(nameKey))) {
        seenIds.add(idKey);
        if (nameKey) seenNames.add(nameKey);
        uniquePlaylists.push(p);
      } else {
        migrated = true;
      }
    });
    history.playlists = uniquePlaylists;
  }
  if (migrated) {
    try {
      localStorage.setItem('suno_player_history_v2', JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }
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
        <span class="history-item-sub">${escapeHtml(getDisplaySubtitle(item.id, type, item))}</span>
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

  if (window.lucide) lucide.createIcons();
}
