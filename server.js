const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ytdl = require('ytdl-core');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const LIBRARY_FILE = path.join(__dirname, 'library.json');
const PORT = process.env.PORT || 3001;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const loadLibrary = () => {
  if (!fs.existsSync(LIBRARY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  } catch (error) {
    console.error('Could not read library.json:', error);
    return [];
  }
};

const saveLibrary = (library) => {
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(library, null, 2), 'utf8');
};

let library = loadLibrary();

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage });

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOAD_DIR));

const computeHash = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

app.get('/api/tracks', (req, res) => {
  res.json(library);
});

app.post('/api/upload', upload.array('tracks'), async (req, res) => {
  const files = req.files || [];
  const added = [];
  const skipped = [];

  for (const file of files) {
    try {
      const hash = await computeHash(file.path);
      const duplicate = library.some((item) => item.id === hash);
      if (duplicate) {
        skipped.push(file.originalname);
        fs.unlinkSync(file.path);
        continue;
      }

      const track = {
        id: hash,
        title: path.basename(file.originalname, path.extname(file.originalname)),
        artist: 'Shared Upload',
        type: 'file',
        size: file.size,
        fileName: file.filename,
        url: `/uploads/${encodeURIComponent(file.filename)}`,
        uploadedAt: new Date().toISOString(),
      };

      library.push(track);
      added.push(track);
    } catch (error) {
      console.error('Upload failed for', file.originalname, error);
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }

  saveLibrary(library);
  res.json({ added, skipped });
});

app.post('/api/youtube', async (req, res) => {
  const { url } = req.body;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const videoId = ytdl.getURLVideoID(url);
    const info = await ytdl.getInfo(videoId);
    const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    const filename = `${Date.now()}-${title}.mp3`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Download audio stream
    const stream = ytdl(videoId, { filter: 'audioonly', quality: 'highestaudio' });
    const writeStream = fs.createWriteStream(filePath);

    stream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.on('error', reject);
    });

    // Compute hash
    const hash = await computeHash(filePath);
    const duplicate = library.some((item) => item.id === hash);
    if (duplicate) {
      fs.unlinkSync(filePath);
      return res.status(409).json({ error: 'Song already exists in library' });
    }

    const track = {
      id: hash,
      title: title,
      artist: 'YouTube Download',
      type: 'file',
      size: fs.statSync(filePath).size,
      fileName: filename,
      url: `/uploads/${encodeURIComponent(filename)}`,
      uploadedAt: new Date().toISOString(),
    };

    library.push(track);
    saveLibrary(library);
    res.json({ added: [track] });
  } catch (error) {
    console.error('YouTube download failed:', error);
    res.status(500).json({ error: 'Failed to download from YouTube' });
  }
});

const startServer = (port, maxRetries = 5) => {
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && maxRetries > 0) {
      console.warn(`Port ${port} is in use. Trying port ${port + 1}...`);
      setTimeout(() => startServer(port + 1, maxRetries - 1), 100);
    } else if (error.code === 'EADDRINUSE') {
      console.error(`Could not start server: port ${port} is already in use. Please stop the process using that port or set PORT to another value.`);
      process.exit(1);
    } else {
      console.error('Server startup error:', error);
      process.exit(1);
    }
  });
};

startServer(PORT);
