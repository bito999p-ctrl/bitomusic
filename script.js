/**
 * ==========================================
 * 設定エリア (Configuration Area)
 * ==========================================
 * ここに表示したいURLを貼り付けてください。
 */
const config = {
    // SpotifyのURLリスト (トラック、アルバム、アーティスト、またはプレイリスト)
    spotifyUrls: [
        "https://open.spotify.com/intl-ja/artist/5PDksV2zctE689I1uOLO2o",
        "https://open.spotify.com/intl-ja/artist/5fejGOb2AqHlneXYKJVwF7",
        "https://open.spotify.com/intl-ja/artist/280n7G2T6dmFkCRs8JFMeX"
    ],

    // YouTubeの動画またはプレイリストのURLリスト
    youtubeUrls: [
        "https://youtube.com/playlist?list=PLxpRgysXp3GnNkrOtAoHCNyQ2nF-TbYCG&si=RwQOr40vfjSit9AU",
        "https://youtube.com/playlist?list=PLxpRgysXp3GnkxK3lm_cwHLD_alvdc_3t&si=iAUFZulgd9aTWcTA",
        "https://youtube.com/playlist?list=PLxpRgysXp3GlUaHN7GwWZheqxz5XCbdzL&si=zhp8sRi9l6GatCre"
    ]
};

/**
 * ==========================================
 * 以下、ロジック部分 (変更不要)
 * ==========================================
 */

document.addEventListener('DOMContentLoaded', () => {
    renderSpotify();
    renderYouTube();
});

function renderSpotify() {
    const container = document.getElementById('spotify-container');
    const urls = config.spotifyUrls;

    if (!urls || urls.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">No Spotify URL provided</div>';
        return;
    }

    container.innerHTML = ''; // Clear container

    urls.forEach(urlStr => {
        try {
            const url = new URL(urlStr);
            // /intl-ja/ などのロケールパスを除去
            const cleanPath = url.pathname.replace(/^\/intl-[a-z]+\//, '/');
            const embedSrc = `https://open.spotify.com/embed${cleanPath}?utm_source=generator&theme=0`;

            const iframe = document.createElement('iframe');
            iframe.src = embedSrc;
            iframe.width = "100%";
            iframe.height = "450"; // Taller height for vertical layout
            iframe.style.minHeight = "450px"; // Ensure it sticks
            iframe.frameBorder = "0";
            iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
            iframe.loading = "lazy";

            container.appendChild(iframe);
        } catch (e) {
            console.error('Invalid Spotify URL', urlStr);
        }
    });
}

function renderYouTube() {
    const container = document.getElementById('youtube-container');
    const urls = config.youtubeUrls;

    if (!urls || urls.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">No YouTube URLs provided</div>';
        return;
    }

    container.innerHTML = ''; // Clear container

    urls.forEach(urlStr => {
        const item = document.createElement('div');
        item.className = 'youtube-item';

        try {
            const { id, isPlaylist } = getYouTubeEmbedInfo(urlStr);
            const embedUrl = isPlaylist
                ? `https://www.youtube.com/embed/videoseries?list=${id}`
                : `https://www.youtube.com/embed/${id}`;

            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.title = "YouTube video player";
            iframe.frameBorder = "0";
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
            iframe.allowFullscreen = true;

            item.appendChild(iframe);
        } catch (e) {
            console.error('Invalid YouTube URL', urlStr);
            item.innerHTML = '<div class="loading-placeholder">Error loading video</div>';
        }

        container.appendChild(item);
    });
}

function getYouTubeEmbedInfo(input) {
    if (!input.includes('/') && !input.includes('.')) {
        return { id: input, isPlaylist: input.startsWith('PL') };
    }

    const url = new URL(input);
    // Handle playlist URLs
    if (url.searchParams.has('list')) {
        return { id: url.searchParams.get('list'), isPlaylist: true };
    }
    // Handle standard video URLs
    if (url.searchParams.has('v')) {
        return { id: url.searchParams.get('v'), isPlaylist: false };
    }
    // Handle youtu.be/ID or youtube.com/embed/ID
    const pathParts = url.pathname.split('/').filter(Boolean);
    return { id: pathParts[pathParts.length - 1], isPlaylist: false };
}
