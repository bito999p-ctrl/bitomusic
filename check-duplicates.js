const http = require('http');

http.get('http://localhost:3000/api/suno?url=%40bito999', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const tracks = parsed.tracks || [];
      console.log('Total tracks fetched:', tracks.length);

      const idCounts = {};
      const titleAudioMap = {};
      
      tracks.forEach((track, idx) => {
        idCounts[track.id] = (idCounts[track.id] || 0) + 1;
        const key = `${track.title} | ${track.audio_url}`;
        titleAudioMap[key] = titleAudioMap[key] || [];
        titleAudioMap[key].push(idx);
      });

      console.log('\n--- Checking for Duplicate IDs ---');
      let dupIdFound = false;
      Object.keys(idCounts).forEach(id => {
        if (idCounts[id] > 1) {
          console.log(`ID ${id} is duplicated ${idCounts[id]} times!`);
          dupIdFound = true;
        }
      });
      if (!dupIdFound) {
        console.log('No duplicate IDs found in the tracks array.');
      }

      console.log('\n--- Checking for Duplicate Title + Audio URL ---');
      let dupTitleAudioFound = false;
      Object.keys(titleAudioMap).forEach(key => {
        if (titleAudioMap[key].length > 1) {
          console.log(`"${key}" is duplicated at indices: ${titleAudioMap[key].join(', ')}`);
          dupTitleAudioFound = true;
        }
      });
      if (!dupTitleAudioFound) {
        console.log('No duplicate Title+Audio URL combinations found.');
      }

    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
});
