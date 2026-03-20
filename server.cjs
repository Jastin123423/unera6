const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const TMP_DIR = path.join(__dirname, 'tmp');
const OUTPUT_DIR = path.join(__dirname, 'outputs');

fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB
  },
});

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'UNERA transcoder running',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    ffmpeg: true,
    tmp_dir: TMP_DIR,
    output_dir: OUTPUT_DIR,
  });
});

app.post('/transcode', upload.single('file'), async (req, res) => {
  const input = req.file;

  if (!input) {
    return res.status(400).json({
      success: false,
      error: 'file is required',
    });
  }

  const inputPath = input.path;
  const baseId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const lowPath = path.join(OUTPUT_DIR, `${baseId}-low.mp4`);
  const mediumPath = path.join(OUTPUT_DIR, `${baseId}-medium.mp4`);
  const hdPath = path.join(OUTPUT_DIR, `${baseId}-hd.mp4`);
  const thumbPath = path.join(OUTPUT_DIR, `${baseId}-thumb.jpg`);

  try {
    // Low - 480p
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vf', 'scale=-2:480',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '30',
      '-maxrate', '800k',
      '-bufsize', '1600k',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      lowPath,
    ]);

    // Medium - 720p
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '27',
      '-maxrate', '1800k',
      '-bufsize', '3600k',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      mediumPath,
    ]);

    // HD - 1080p
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vf', 'scale=-2:1080',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '24',
      '-maxrate', '3500k',
      '-bufsize', '7000k',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      hdPath,
    ]);

    // Thumbnail
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-ss', '00:00:01',
      '-vframes', '1',
      '-vf', 'scale=-2:720',
      thumbPath,
    ]);

    const lowStat = safeStat(lowPath);
    const mediumStat = safeStat(mediumPath);
    const hdStat = safeStat(hdPath);
    const thumbStat = safeStat(thumbPath);

    return res.json({
      success: true,
      input: {
        original_name: input.originalname,
        mime_type: input.mimetype,
        temp_path: inputPath,
        size_bytes: input.size,
      },
      outputs: {
        low: {
          path: lowPath,
          filename: path.basename(lowPath),
          size_bytes: lowStat ? lowStat.size : 0,
        },
        medium: {
          path: mediumPath,
          filename: path.basename(mediumPath),
          size_bytes: mediumStat ? mediumStat.size : 0,
        },
        hd: {
          path: hdPath,
          filename: path.basename(hdPath),
          size_bytes: hdStat ? hdStat.size : 0,
        },
        thumbnail: {
          path: thumbPath,
          filename: path.basename(thumbPath),
          size_bytes: thumbStat ? thumbStat.size : 0,
        },
      },
    });
  } catch (error) {
    safeUnlink(lowPath);
    safeUnlink(mediumPath);
    safeUnlink(hdPath);
    safeUnlink(thumbPath);

    return res.status(500).json({
      success: false,
      error: error.message || 'Transcoding failed',
    });
  } finally {
    safeUnlink(inputPath);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`UNERA transcoder listening on http://0.0.0.0:${PORT}`);
});
