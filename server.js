const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, "public")));

// Set the path for ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Configure multer storage
const UPLOAD_DIR = path.join(__dirname, "public/uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// File type validation - only allow images and audio
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/x-icon', 'image/svg+xml'];
  const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/x-wav'];
  
  if (allowedImageTypes.includes(file.mimetype) || allowedAudioTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and audio files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Middleware to ensure upload directory exists
app.use((req, res, next) => {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create upload directory:', err);
    // Don't block request - continue anyway as directory might exist
  }
  next();
});

// Routes
app.get("/", async (req, res) => {
  // Read all files in the uploads directory and delete only old files (older than 1 hour)
  const MAX_FILE_AGE_MS = 60 * 60 * 1000; // 1 hour
  const now = Date.now();

  try {
    const files = await fs.promises.readdir(UPLOAD_DIR);

    // Delete old files and collect promises
    const deletionPromises = files.map(async (file) => {
      const filePath = path.join(UPLOAD_DIR, file);

      try {
        const stats = await fs.promises.stat(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > MAX_FILE_AGE_MS) {
          await fs.promises.unlink(filePath);
          console.log(`Deleted old file: ${file}`);
        }
      } catch (err) {
        console.error(`Error processing file ${file}:`, err);
      }
    });

    // Wait for all deletions to complete before sending response
    await Promise.all(deletionPromises);
  } catch (err) {
    console.error("Error reading directory:", err);
    // Continue even if there's an error - don't block the response
  }

  res.render("pages/index");
});

app.post("/convert", upload.array("file"), async (req, res, next) => {
  // Get output formats from request body - can be single format or array for multiple files
  const outputFormats = req.body.formats;
  const outputFormat = req.body.format; // single format fallback
  
  // Check if files were uploaded
  if (!req.files || req.files.length === 0) {
    return res.status(400).render("pages/result", {
      files: [],
      error: "No files were uploaded. Please select a file to convert."
    });
  }
  
  // Determine formats for each file
  const formats = [];
  if (Array.isArray(outputFormats)) {
    // Multiple formats provided
    for (let i = 0; i < req.files.length; i++) {
      formats.push(outputFormats[i] || outputFormats[0] || outputFormat);
    }
  } else if (outputFormats) {
    // Single format for all files
    for (let i = 0; i < req.files.length; i++) {
      formats.push(outputFormats);
    }
  } else {
    // Use single format for all files
    for (let i = 0; i < req.files.length; i++) {
      formats.push(outputFormat);
    }
  }
  
  // Validate output formats
  const allowedImageFormats = ['jpeg', 'png', 'webp'];
  const allowedAudioFormats = ['mp3', 'wav', 'ogg'];
  const allAllowedFormats = [...allowedImageFormats, ...allowedAudioFormats];
  
  for (const fmt of formats) {
    if (!fmt || !allAllowedFormats.includes(fmt)) {
      return res.status(400).render("pages/result", {
        files: [],
        error: "Invalid output format. Please select a valid format."
      });
    }
  }
  
  const convertedFiles = [];

  try {
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileFormat = formats[i];
      const mimeType = file.mimetype;
      const parsedPath = path.parse(file.originalname);
      const outputFilePath = path.join(UPLOAD_DIR, `converted-${Date.now()}-${i}-${parsedPath.name}.${fileFormat}`);

      // Check file type and restrict conversion
      if (mimeType.startsWith("image/")) {
        if (!allowedImageFormats.includes(fileFormat)) {
          return res.status(400).render("pages/result", {
            files: [],
            error: `Invalid output format "${fileFormat}" for image files. Allowed formats: jpeg, png, webp.`
          });
        }
        await sharp(file.path).toFormat(fileFormat).toFile(outputFilePath);
      } else if (mimeType.startsWith("audio/")) {
        if (!allowedAudioFormats.includes(fileFormat)) {
          return res.status(400).render("pages/result", {
            files: [],
            error: `Invalid output format "${fileFormat}" for audio files. Allowed formats: mp3, wav, ogg.`
          });
        }
        await new Promise((resolve, reject) => {
          ffmpeg(file.path)
            .format(fileFormat)
            .on("error", reject)
            .on("end", resolve)
            .save(outputFilePath);
        });
      } else {
        return res.status(400).render("pages/result", {
          files: [],
          error: "Unsupported file type. Only image and audio files are supported."
        });
      }

      convertedFiles.push(outputFilePath);
    }

    // If multiple files, create a ZIP; otherwise serve single file
    if (convertedFiles.length > 1) {
      const zipFileName = `converted-${Date.now()}.zip`;
      const zipFilePath = path.join(UPLOAD_DIR, zipFileName);
      
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', resolve);
        archive.on('error', reject);
        
        archive.pipe(output);
        
        for (const filePath of convertedFiles) {
          archive.file(filePath, { name: path.basename(filePath) });
        }
        
        archive.finalize();
      });
      
      // Clean up individual converted files
      for (const filePath of convertedFiles) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      
      res.render("pages/result", {
        files: [zipFileName],
        isZip: true,
        error: null,
      });
    } else {
      // Single file - render result page with the converted file
      res.render("pages/result", {
        files: convertedFiles.map((f) => path.basename(f)),
        isZip: false,
        error: null,
      });
    }
  } catch (error) {
    console.error("Conversion error:", error);
    // Pass error to global error handler
    return next(error);
  }
});

// Route to handle file downloads
app.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  
  // Security: Prevent path traversal attacks
  // Only allow alphanumeric characters, hyphens, underscores, and dots
  const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  
  // Ensure the filename is not empty after sanitization
  if (!safeFilename || safeFilename.length === 0) {
    console.warn(`Empty or invalid filename: ${filename}`);
    return res.status(400).send("Invalid filename.");
  }
  
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  // Verify the resolved path is within the uploads directory
  const uploadsDir = UPLOAD_DIR;
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);
  if (!resolvedPath.startsWith(resolvedUploadsDir)) {
    console.warn(`Path traversal attempt detected: ${filename}`);
    return res.status(400).send("Invalid filename.");
  }

  // Check if file exists before attempting download
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found.");
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error(`Failed to download ${safeFilename}: ${err}`);
    } else {
      // Delete the file after download
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Failed to delete ${safeFilename} after download: ${err}`);
        } else {
          console.log(`Deleted ${safeFilename} after download`);
        }
      });
    }
  });
});

// Global error handler for Multer and other errors
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).render("pages/result", {
        files: [],
        error: "File too large. Maximum size is 50MB."
      });
    }
    return res.status(400).render("pages/result", {
      files: [],
      error: `Upload error: ${err.message}`
    });
  }
  
  // Handle other errors
  res.status(500).render("pages/result", {
    files: [],
    error: "An unexpected error occurred. Please try again."
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
