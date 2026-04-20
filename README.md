# Offline Music App

A Spotify-style offline music player built as a static web app.

## Features
- Upload local audio files directly in the browser
- Play tracks without internet after upload
- No login or user account required
- Prevents duplicate uploads of the same song
- Spotify-like dark UI with playlist and now playing panel
- Search songs by title or artist
- Download YouTube songs and add to library

## Run locally
1. Install dependencies:
   ```
   npm install
   ```
2. Start the app server:
   ```
   npm start
   ```
3. Open `http://localhost:3001` in your browser.
4. Click `Upload songs` to add local audio files, or `Download YouTube` to download and add YouTube songs.
5. Tap a track to start playback.

## Notes
- Uploaded songs are saved on the local app server and remain visible to all users of the same server.
- YouTube songs are downloaded as MP3 and stored locally.
- The app does not require a login page.
- Duplicate uploads and YouTube downloads are skipped.
- Songs remain available until the app developer removes them or clears the server storage.

