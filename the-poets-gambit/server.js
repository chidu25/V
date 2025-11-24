const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const multer = require('multer');
const { nanoid } = require('nanoid');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');
const rendersDir = path.join(__dirname, 'renders');

for (const dir of [uploadsDir, rendersDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ffmpeg.setFfmpegPath(ffmpegPath);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are supported'));
    }
    cb(null, true);
  }
});

const sanitizeText = (value = '', fallback = '') => {
  const safe = String(value).trim() || fallback;
  return safe.replace(/[:\\n]/g, ' ').replace(/'/g, "\\'");
};

const sanitizeColor = (value = '#f6c344') => {
  const hex = String(value).trim();
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#f6c344';
};

const renderVideo = ({
  inputPath,
  title,
  tagline,
  accentColor,
  duration = 8,
  motion = 'cinematic'
}) => {
  const outputPath = path.join(rendersDir, `${Date.now()}-${nanoid(10)}.mp4`);
  const frames = Math.max(Math.floor(duration * 30), 90);
  const zoomAmount = motion === 'pulse' ? "1.05+0.05*sin(2*PI*t/" + duration + ")" : motion === 'pan' ? "1.05" : "min(zoom+0.0025,1.18)";
  const motionFilter = motion === 'pan'
    ? `zoompan=z=1.05:d=${frames}:x='iw*0.02*t/${duration}':y='ih*0.02*t/${duration}':s=1920x1080:fps=30`
    : `zoompan=z='${zoomAmount}':d=${frames}:s=1920x1080:fps=30`;

  const safeTitle = sanitizeText(title, 'Cinematic Graphic');
  const safeTagline = sanitizeText(tagline, 'Generated from your upload');
  const safeAccent = sanitizeColor(accentColor);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(['-loop 1'])
      .outputOptions([
        '-preset', 'veryfast',
        '-movflags', 'faststart',
        '-pix_fmt', 'yuv420p'
      ])
      .complexFilter([
        {
          filter: 'scale',
          options: { w: 1920, h: -1 },
          inputs: '0:v',
          outputs: 'scaled'
        },
        `[scaled]${motionFilter},format=yuv420p[video]`,
        {
          filter: 'drawbox',
          options: {
            x: 0,
            y: 'h-260',
            w: 'iw',
            h: 260,
            color: 'black@0.55',
            t: 'fill'
          },
          inputs: 'video',
          outputs: 'boxed'
        },
        {
          filter: 'drawtext',
          options: {
            fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            text: safeTitle,
            fontsize: 60,
            fontcolor: 'white@0.97',
            x: 80,
            y: 'h-200',
            shadowcolor: 'black@0.4',
            shadowx: 2,
            shadowy: 2
          },
          inputs: 'boxed',
          outputs: 'title'
        },
        {
          filter: 'drawtext',
          options: {
            fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            text: safeTagline,
            fontsize: 40,
            fontcolor: `${safeAccent}@0.98`,
            x: 80,
            y: 'h-120'
          },
          inputs: 'title',
          outputs: 'out'
        }
      ], 'out')
      .duration(duration)
      .on('error', reject)
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/render', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image is required' });
  }

  try {
    const { title, tagline, accentColor, duration, motion } = req.body;
    const resultPath = await renderVideo({
      inputPath: req.file.path,
      title,
      tagline,
      accentColor,
      duration: Math.max(5, Math.min(Number(duration) || 8, 20)),
      motion
    });

    res.download(resultPath, 'visualfoundry.mp4', err => {
      fs.unlink(req.file.path, () => {});
      fs.unlink(resultPath, () => {});
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Unable to stream render', details: err.message });
      }
    });
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Render failed', details: error.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Unexpected error', details: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VisualFoundry listening on port ${PORT}`);
  });
}

module.exports = app;
