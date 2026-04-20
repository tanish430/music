const uploadInput = document.getElementById('songUpload');
const playlistEl = document.getElementById('playlist');
const trackCountEl = document.getElementById('trackCount');
const audioPlayer = document.getElementById('audioPlayer');
const currentTitleEl = document.getElementById('currentTitle');
const currentMetaEl = document.getElementById('currentMeta');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageTitleEl = document.getElementById('pageTitle');
const pageSubtitleEl = document.getElementById('pageSubtitle');
const pageHintEl = document.getElementById('pageHint');
const appWarningEl = document.getElementById('appWarning');
const navButtons = document.querySelectorAll('.nav-btn');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const youtubeBtn = document.getElementById('youtubeBtn');

const tracks = [];
const trackIds = new Set();
let currentIndex = -1;
let isPlaying = false;
let searchQuery = '';
const API_BASE = '';
const isLocalFile = window.location.protocol === 'file:';

const showAppWarning = (message) => {
  if (!appWarningEl) return;
  appWarningEl.innerHTML = message;
  appWarningEl.style.display = 'block';
};

const hideAppWarning = () => {
  if (!appWarningEl) return;
  appWarningEl.style.display = 'none';
};

const disableLocalFileMode = () => {
  showAppWarning('The app is running from <strong>file://</strong>. Open it through the backend server at <strong>http://localhost:3001</strong>.');
  pageHintEl.textContent = 'Please start the app server and open the app via http://localhost:3001 instead of opening the file directly.';
  uploadInput.disabled = true;
  youtubeBtn.disabled = true;
  clearSearchBtn.disabled = true;
};
if (isLocalFile) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', disableLocalFileMode);
  } else {
    disableLocalFileMode();
  }
}

const formatDuration = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
};

const fetchTracks = async () => {
  if (isLocalFile) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/api/tracks`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    tracks.length = 0;
    trackIds.clear();

    data.forEach((track) => {
    const loadedTrack = {
      ...track,
      durationText: track.durationText || 'Loading…',
      url: track.url,
    };
    tracks.push(loadedTrack);
    trackIds.add(track.id);

    if (!track.durationText || track.durationText === 'Loading…') {
      const metadataAudio = new Audio(track.url);
      metadataAudio.addEventListener('loadedmetadata', () => {
        loadedTrack.durationText = formatDuration(metadataAudio.duration);
        updatePlaylist();
        metadataAudio.remove();
      });
    }
  });
  hideAppWarning();
  pageHintEl.textContent = 'Shared playlist loaded successfully.';
  uploadInput.disabled = false;
  youtubeBtn.disabled = false;
  clearSearchBtn.disabled = false;
  return true;
  } catch (error) {
    console.error('Could not load shared tracks:', error);
    showAppWarning('Server not available. Start the backend and open the app at <strong>http://localhost:3001</strong>.');
    pageHintEl.textContent = 'Shared library could not be loaded. Please start the server.';
    uploadInput.disabled = true;
    youtubeBtn.disabled = true;
    clearSearchBtn.disabled = true;
    return false;
  }
};

const updatePlaylist = () => {
  playlistEl.innerHTML = '';
  const filteredTracks = tracks.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (track.artist && track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  trackCountEl.textContent = `${filteredTracks.length} track${filteredTracks.length === 1 ? '' : 's'}${searchQuery ? ` (filtered from ${tracks.length})` : ''}`;

  filteredTracks.forEach((track, index) => {
    const originalIndex = tracks.indexOf(track);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'track-card' + (originalIndex === currentIndex ? ' active' : '');
    card.innerHTML = `
      <div class="track-thumb">${track.type === 'youtube' ? '▶' : originalIndex + 1}</div>
      <div class="track-details">
        <strong>${track.title}</strong>
        <span>${track.artist || 'Unknown artist'} • ${track.durationText || 'External'}</span>
      </div>
      <span>${track.type === 'youtube' ? 'YouTube' : (track.durationText || 'External')}</span>
    `;
    card.addEventListener('click', () => playTrack(originalIndex));
    playlistEl.appendChild(card);
  });
};

const setNowPlaying = (track) => {
  if (!track) {
    currentTitleEl.textContent = 'Nothing selected';
    currentMetaEl.textContent = 'Upload a song to start playback.';
    audioPlayer.removeAttribute('src');
    return;
  }
  currentTitleEl.textContent = track.title;
  currentMetaEl.textContent = `${track.artist || 'Unknown artist'} • ${track.durationText}`;
  audioPlayer.src = track.url;
  audioPlayer.load();
};

const playTrack = (index) => {
  if (index < 0 || index >= tracks.length) return;
  const track = tracks[index];

  if (track.type === 'youtube') {
    // Open YouTube video in new tab
    window.open(track.url, '_blank');
    return;
  }

  currentIndex = index;
  setNowPlaying(track);
  updatePlaylist();
  audioPlayer.play();
  isPlaying = true;
  playPauseBtn.textContent = '⏸';
};

const togglePlayPause = () => {
  if (!audioPlayer.src) return;
  if (audioPlayer.paused) {
    audioPlayer.play();
    playPauseBtn.textContent = '⏸';
    isPlaying = true;
  } else {
    audioPlayer.pause();
    playPauseBtn.textContent = '▶';
    isPlaying = false;
  }
};

const playNext = () => {
  if (tracks.length === 0) return;
  const nextIndex = currentIndex + 1 < tracks.length ? currentIndex + 1 : 0;
  playTrack(nextIndex);
};

const playPrev = () => {
  if (tracks.length === 0) return;
  const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : tracks.length - 1;
  playTrack(prevIndex);
};

const addYouTubeLink = async () => {
  const url = prompt('Enter YouTube URL:');
  if (!url || !url.trim()) return;

  // Basic YouTube URL validation
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  if (!youtubeRegex.test(url)) {
    alert('Please enter a valid YouTube URL');
    return;
  }

  const videoId = url.match(youtubeRegex)[1];
  const track = {
    id: `youtube-${videoId}`,
    title: `YouTube Video ${videoId}`,
    artist: 'YouTube Link',
    type: 'youtube',
    url: url,
    uploadedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${API_BASE}/api/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track),
    });

    if (response.ok) {
      await fetchTracks();
    } else {
      const error = await response.json();
      alert(`Failed to add YouTube link: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error adding YouTube link:', error);
    alert('Failed to add YouTube link. Please try again.');
  }
};

const handleSearch = () => {
  searchQuery = searchInput.value.trim();
  updatePlaylist();
  clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
};

const clearSearch = () => {
  searchInput.value = '';
  searchQuery = '';
  updatePlaylist();
  clearSearchBtn.style.display = 'none';
  searchInput.focus();
};

const pageInfo = {
  home: {
    title: 'Discover Your Music',
    subtitle: 'Upload tracks, play offline, no login needed.',
    hint: 'Browse the shared playlist and play songs uploaded by all users.',
  },
  library: {
    title: 'Library',
    subtitle: 'All uploaded songs are available here.',
    hint: 'Select any track to play it instantly from the shared library.',
  },
  upload: {
    title: 'Upload Music',
    subtitle: 'Add songs from your device to the shared library.',
    hint: 'Choose audio files to add them to the shared music list.',
  },
};

const selectPage = (pageKey) => {
  navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.page === pageKey));
  const page = pageInfo[pageKey] || pageInfo.home;
  pageTitleEl.textContent = page.title;
  pageSubtitleEl.textContent = page.subtitle;
  pageHintEl.textContent = page.hint;

  if (pageKey === 'upload') {
    uploadInput.click();
  }
};

uploadInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const formData = new FormData();
  files.forEach((file) => formData.append('tracks', file));

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    alert(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    return;
  }

  const result = await response.json();
  if (result.skipped?.length) {
    alert(`Duplicate upload skipped: ${result.skipped.join(', ')}`);
  }

  await fetchTracks();
  if (currentIndex === -1 && tracks.length > 0) {
    playTrack(0);
  }
  uploadInput.value = '';
});

youtubeBtn.addEventListener('click', addYouTubeLink);

searchInput.addEventListener('input', handleSearch);
clearSearchBtn.addEventListener('click', clearSearch);

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => selectPage(btn.dataset.page));
});

playPauseBtn.addEventListener('click', togglePlayPause);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);

fetchTracks()
  .then(() => updatePlaylist())
  .catch((error) => {
    console.error('Could not load shared tracks:', error);
    updatePlaylist();
  });
