const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Serve static client files from the AETHER_PLAYER directory
app.use(express.static(path.join(__dirname, 'AETHER_PLAYER')));

function resolveRscReference(combined, ref) {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('$')) return ref;
  
  const key = ref.replace(/^\$L?/, '');
  let searchStr = `\n${key}:`;
  let idx = combined.indexOf(searchStr);
  if (idx === -1) {
    searchStr = `${key}:`;
    if (combined.startsWith(searchStr)) {
      idx = 0;
    }
  }
  
  if (idx !== -1) {
    const lineStart = idx + searchStr.length;
    // Find the end of this definition by looking for the next definition header
    const nextDefRegex = /\n(?:[a-f0-9]+:|:)/gi;
    nextDefRegex.lastIndex = lineStart;
    const nextMatch = nextDefRegex.exec(combined);
    
    const lineEnd = nextMatch ? nextMatch.index : combined.length;
    const lineContent = combined.slice(lineStart, lineEnd);
    if (lineContent.startsWith('T')) {
      const commaIdx = lineContent.indexOf(',');
      if (commaIdx !== -1) {
        return lineContent.slice(commaIdx + 1);
      }
    }
    return lineContent;
  }
  return ref;
}

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
      let inString = false;
      let quoteChar = null;
      let escaped = false;
      const startIdx = idx + 'self.__next_f.push('.length;

      for (let i = startIdx; i < html.length; i++) {
        const char = html[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (inString) {
          if (char === quoteChar) {
            inString = false;
          }
        } else {
          if (char === '"' || char === "'") {
            inString = true;
            quoteChar = char;
          } else if (char === '(' || char === '[') {
            braceCount++;
          } else if (char === ')' || char === ']') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
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
    const tracks = [];
    const seenTrackIds = new Set();
    const seenAudioUrls = new Set();

    // Find all occurrences of "id" key followed by a 36-char UUID
    const idRegex = /"id"\s*:\s*"([a-f0-9\-]{36})"/gi;
    let idMatch;

    while ((idMatch = idRegex.exec(combined)) !== null) {
      const uuid = idMatch[1];
      if (seenTrackIds.has(uuid)) continue;

      // Scan backwards from the match index to find the starting '{' of this object at braceLevel 0
      let startIdx = -1;
      let braceLevel = 0;
      for (let i = idMatch.index; i >= 0; i--) {
        if (combined[i] === '}') braceLevel++;
        else if (combined[i] === '{') {
          if (braceLevel === 0) {
            startIdx = i;
            break;
          } else {
            braceLevel--;
          }
        }
      }

      if (startIdx !== -1) {
        // Walk forward from startIdx to find the matching closing '}'
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
          const objStr = combined.slice(startIdx, endIdx + 1);
          // Use robust regex-based property extraction to bypass malformed JSON / unquoted references in Next.js RSC payload
          const titleMatch = objStr.match(/"title"\s*:\s*"([^"]+)"/i);
          if (titleMatch) {
            const audioMatch = objStr.match(/"audio_url"\s*:\s*"([^"]+)"/i);
            const audio_url = audioMatch ? audioMatch[1] : `https://cdn1.suno.ai/${uuid}.mp3`;
            
            // Skip duplicate audio URLs (e.g. hook schemas, video uploads, or multiple references)
            if (seenAudioUrls.has(audio_url)) continue;
            
            seenTrackIds.add(uuid);
            seenAudioUrls.add(audio_url);
            
            const title = titleMatch[1];
            
            const imageMatch = objStr.match(/"image_url"\s*:\s*"([^"]+)"/i);
            const image_url = imageMatch ? imageMatch[1] : `https://cdn1.suno.ai/image_${uuid}.png`;
            
            const artistMatch = objStr.match(/"(?:user_display_name|display_name)"\s*:\s*"([^"]+)"/i);
            const artist_name = artistMatch ? artistMatch[1] : 'Suno Artist';
            
            const durationMatch = objStr.match(/"duration"\s*:\s*([0-9\.]+)/i);
            const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;
            
            const playMatch = objStr.match(/"play_count"\s*:\s*([0-9]+)/i);
            const play_count = playMatch ? parseInt(playMatch[1], 10) : 0;
            
            const upvoteMatch = objStr.match(/"upvote_count"\s*:\s*([0-9]+)/i);
            const upvote_count = upvoteMatch ? parseInt(upvoteMatch[1], 10) : 0;
            
            const promptMatch = objStr.match(/"prompt"\s*:\s*"([^"]+)"/i);
            let description = '';
            if (promptMatch) {
              let rawPrompt = promptMatch[1];
              // Resolve Next.js App Router reference (e.g. "$5f") if needed
              rawPrompt = resolveRscReference(combined, rawPrompt);
              
              description = rawPrompt
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
            }

            const createdMatch = objStr.match(/"created_at"\s*:\s*"([^"]+)"/i);
            const created_at = createdMatch ? createdMatch[1] : '';

            tracks.push({
              id: uuid,
              title,
              audio_url,
              image_url,
              artist_name,
              duration,
              play_count,
              upvote_count,
              description,
              created_at
            });
          }
        }
      }
    }

    // Extract playlists (if it's a profile page, fetch playlists from regular HTML and RSC pushes)
    const playlists = [];
    if (isProfile) {
      const seenPlaylists = new Set();

      // 1. Extract from RSC pushes (supports all public playlists beyond the first 5 SSR limit)
      const rscPlaylistRegex = /playlist_id\\"\s*:\s*\\"([a-f0-9\-]{36})\\"\s*,\s*\\"playlist_name\\"\s*:\s*\\"([^\\"]+)\\"\s*,\s*\\"playlist_image_url\\"\s*:\s*\\"([^\\"]+)\\"/gi;
      let rscMatch;
      while ((rscMatch = rscPlaylistRegex.exec(html)) !== null) {
        const id = rscMatch[1];
        const name = rscMatch[2]
          .replace(/\\u0026/g, '&')
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"');
        const image_url = rscMatch[3];
        
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

      // 2. Fallback to SSR static HTML href tags
      const playlistRegex = /href="\/playlist\/([a-f0-9\-]{36})"[^>]*>[\s\S]*?<img\s+alt="([^"]*)"\s+src="([^"]*)"/g;
      let match;
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

    // Truncate profile tracks to first 20 items to match Suno page 1 and avoid playlist tracks mix-in
    if (isProfile && tracks.length > 20) {
      tracks.length = 20;
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


/**
 * Route: GET /api/proxy-audio
 * Proxies audio file requests from Suno CDNs to support HTTP range seeking and bypass CORS.
 */
app.get('/api/proxy-audio', (req, res) => {
  const audioUrl = req.query.url;
  if (!audioUrl) {
    return res.status(400).send('Missing url parameter');
  }
  const https = require('https');
  const url = require('url');

  const parsedUrl = url.parse(audioUrl);
  const hostname = parsedUrl.hostname || '';
  const isSunoDomain = hostname.endsWith('.suno.ai') || hostname.endsWith('.suno.com') || hostname === 'suno.ai' || hostname === 'suno.com';
  
  if (!isSunoDomain) {
    return res.status(403).send('Forbidden: Only Suno domains are permitted to be proxied.');
  }

  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://suno.com/',
    'Origin': 'https://suno.com'
  };

  if (req.headers.range) {
    reqHeaders['Range'] = req.headers.range;
  }

  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    headers: reqHeaders
  };

  https.get(options, (proxyRes) => {
    if (proxyRes.headers['content-range']) {
      res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    if (proxyRes.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
    }
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }

    res.status(proxyRes.statusCode || 200);
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('[Proxy Audio Error] Failed to stream audio:', err.message);
    res.status(500).send(`Internal server error: ${err.message}`);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Server] Suno Player backend running on http://localhost:${PORT}`);
});
