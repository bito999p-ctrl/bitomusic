const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static client files from the AETHER_PLAYER directory
app.use(express.static(path.join(__dirname, 'AETHER_PLAYER')));

/**
 * Route: GET /api/suno
 * Fetches and parses a Suno playlist or profile URL.
 */
app.get('/api/suno', async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  targetUrl = targetUrl.trim();

  // Helper auto-completion for usernames and IDs
  if (targetUrl.startsWith('@')) {
    targetUrl = `https://suno.com/${targetUrl}`;
  } else if (/^[a-f0-9\-]{36}$/i.test(targetUrl)) {
    targetUrl = `https://suno.com/playlist/${targetUrl}`;
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (targetUrl.includes('.') || targetUrl.includes('/')) {
      targetUrl = 'https://' + targetUrl;
    } else {
      // Default to user profile if just a string is passed
      targetUrl = `https://suno.com/@${targetUrl}`;
    }
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (!parsedUrl.hostname.endsWith('suno.com')) {
      return res.status(400).json({ error: 'URL must be a suno.com link' });
    }

    console.log(`[Proxy] Fetching target URL: ${targetUrl}`);
    const fetchRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({ error: `Failed to fetch Suno page: ${fetchRes.statusText}` });
    }

    const html = await fetchRes.text();
    console.log(`[Proxy] Successfully fetched HTML. Length: ${html.length} bytes.`);

    // Determine type: profile or playlist
    const isProfile = parsedUrl.pathname.startsWith('/@');
    const isPlaylist = parsedUrl.pathname.startsWith('/playlist/');

    // Parse RSC pushes (self.__next_f.push)
    let pos = 0;
    const pushes = [];

    while (true) {
      const idx = html.indexOf('self.__next_f.push(', pos);
      if (idx === -1) break;

      let braceCount = 0;
      let endIdx = -1;
      const startIdx = idx + 'self.__next_f.push('.length;

      for (let i = startIdx; i < html.length; i++) {
        if (html[i] === '(' || html[i] === '[') braceCount++;
        else if (html[i] === ')' || html[i] === ']') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx !== -1) {
        const argStr = html.slice(startIdx, endIdx + 1);
        const commaIdx = argStr.indexOf(',');
        if (commaIdx !== -1) {
          let strVal = argStr.slice(commaIdx + 1).trim();
          if (strVal.endsWith(']')) {
            strVal = strVal.slice(0, -1).trim();
          }
          if ((strVal.startsWith('"') && strVal.endsWith('"')) || (strVal.startsWith("'") && strVal.endsWith("'"))) {
            strVal = strVal.slice(1, -1);
            let jsString = '"' + strVal.replace(/(^"|"$)/g, '') + '"';
            try {
              const decoded = JSON.parse(jsString);
              pushes.push(decoded);
            } catch (err) {
              let unescaped = strVal
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
              pushes.push(unescaped);
            }
          }
        }
        pos = endIdx + 1;
      } else {
        pos = idx + 1;
      }
    }

    const combined = pushes.join('');

    // Extract tracks
    const clipIndexRegex = /"clip"\s*:\s*\{/g;
    let clipMatch;
    const tracks = [];
    const seenTrackIds = new Set();

    while ((clipMatch = clipIndexRegex.exec(combined)) !== null) {
      const startIdx = clipMatch.index + clipMatch[0].length - 1; // start at '{'
      let braceCount = 0;
      let endIdx = -1;
      for (let i = startIdx; i < combined.length; i++) {
        if (combined[i] === '{') braceCount++;
        else if (combined[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx !== -1) {
        const clipJsonStr = combined.slice(startIdx, endIdx + 1);
        try {
          const clip = JSON.parse(clipJsonStr);
          if (clip && clip.id && !seenTrackIds.has(clip.id)) {
            seenTrackIds.add(clip.id);
            tracks.push({
              id: clip.id,
              title: clip.title || 'Untitled',
              audio_url: clip.audio_url || `https://cdn1.suno.ai/${clip.id}.mp3`,
              image_url: clip.image_url || `https://cdn1.suno.ai/image_${clip.id}.png`,
              artist_name: clip.user_display_name || clip.display_name || 'Suno Artist',
              duration: clip.duration || 0,
              play_count: clip.play_count || 0,
              upvote_count: clip.upvote_count || 0,
              description: clip.metadata?.prompt || clip.metadata?.tags || ''
            });
          }
        } catch (e) {
          // Ignore parse errors on partial matches
        }
      }
    }

    // Extract playlists (if it's a profile page, fetch playlists from regular HTML)
    const playlists = [];
    if (isProfile) {
      const playlistRegex = /href="\/playlist\/([a-f0-9\-]{36})"[^>]*>[\s\S]*?<img\s+alt="([^"]*)"\s+src="([^"]*)"/g;
      let match;
      const seenPlaylists = new Set();

      while ((match = playlistRegex.exec(html)) !== null) {
        const id = match[1];
        const name = match[2];
        const image_url = match[3];

        if (!seenPlaylists.has(id)) {
          seenPlaylists.add(id);
          playlists.push({
            id,
            name,
            image_url,
            url: `https://suno.com/playlist/${id}`
          });
        }
      }
    }

    // Extract name of profile or playlist
    let name = 'Suno Catalog';
    if (isProfile) {
      const match = html.match(/<title>([^|]+)/);
      if (match) {
        name = match[1].replace('Profile', '').trim();
      } else {
        name = parsedUrl.pathname.replace('/@', '');
      }
    } else if (isPlaylist) {
      const match = html.match(/<title>([^|]+)/);
      if (match) {
        name = match[1].replace('Playlist', '').trim();
      }
    }

    return res.json({
      type: isProfile ? 'profile' : isPlaylist ? 'playlist' : 'unknown',
      name,
      tracks,
      playlists
    });

  } catch (err) {
    console.error(`[Error] Fetching/parsing error:`, err);
    return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Server] Suno Player backend running on http://localhost:${PORT}`);
});
