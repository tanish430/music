const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

app.post('/api/youtube', (req, res) => {
  const { id, title, artist, type, url, uploadedAt } = req.body;

  if (!id || !url || type !== 'youtube') {
    return res.status(400).json({ error: 'Invalid YouTube link data' });
  }

  // Check for duplicate YouTube links
  const duplicate = library.some((item) => item.id === id);
  if (duplicate) {
    return res.status(409).json({ error: 'YouTube link already exists' });
  }

  const track = {
    id,
    title,
    artist,
    type,
    url,
    uploadedAt,
  };

  library.push(track);
  saveLibrary(library);
  res.json({ added: [track] });
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
