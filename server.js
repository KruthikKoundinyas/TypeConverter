const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Add this near the top of your server.js
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

// Set the path for ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Middleware to delete contents of the upload folder on site entry
app.use((req, res, next) => {
  fs.readdir("public/uploads/", (err, files) => {
    if (err) return next(err);
    for (const file of files) {
      fs.unlink(path.join("public/uploads/", file), (err) => {
        if (err) console.error(`Failed to delete ${file}: ${err}`);
      });
    }
  });
  next();
});

// Routes
app.get("/", (req, res) => {
  const uploadDir = path.join(__dirname, "uploads"); // Path to the uploads directory
  // Read all files in the uploads directory
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return res.status(500).send("Error reading directory.");
    }

    // Loop through all files and delete them
    files.forEach((file) => {
      const filePath = path.join(uploadDir, file);

      // Delete the file
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
        }
      });
    });
  });
  res.render("pages/index");
});

app.post("/convert", upload.array("file"), async (req, res) => {
  const outputFormat = req.body.format;
  const convertedFiles = [];

  try {
    for (const file of req.files) {
      const mimeType = file.mimetype;
      const parsedPath = path.parse(file.originalname);
      const outputFilePath = `public/uploads/converted-${Date.now()}-${
        parsedPath.name
      }.${outputFormat}`;

      // Check file type and restrict conversion
      if (mimeType.startsWith("image/")) {
        if (!["jpeg", "png", "webp"].includes(outputFormat)) {
          return res.status(400).send("Invalid output format for image files.");
        }
        await sharp(file.path).toFormat(outputFormat).toFile(outputFilePath);
      } else if (mimeType.startsWith("audio/")) {
        if (!["mp3", "wav", "ogg"].includes(outputFormat)) {
          return res.status(400).send("Invalid output format for audio files.");
        }
        await new Promise((resolve, reject) => {
          ffmpeg(file.path)
            .format(outputFormat)
            .on("error", reject)
            .on("end", resolve)
            .save(outputFilePath);
        });
      } else {
        return res.status(400).send("Unsupported file type.");
      }

      convertedFiles.push(outputFilePath);
    }

    // If successful, render result view with files
    res.render("pages/result", {
      files: convertedFiles.map((f) => path.basename(f)),
      error: null, // No error, so we pass null
    });

    // Optionally delete original uploaded files after conversion
    // req.files.forEach((file) => {
    //   fs.unlink(file.path, (err) => {
    //     if (err) console.error(`Failed to delete ${file.filename}: ${err}`);
    //   });
    // });
  } catch (error) {
    console.error("Conversion error:", error);
    res.render("pages/result", {
      files: [], // No files to display
      error: "Error converting files. Please try again. Go Back to home page", // Pass the error message
    });
  }
});

// Route to handle file downloads
app.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "public/uploads/", filename);

  res.download(filePath, (err) => {
    if (err) {
      console.error(`Failed to download ${filename}: ${err}`);
    } else {
      // Delete the file after download
      fs.unlink(filePath, (err) => {
        if (err)
          console.error(`Failed to delete ${filename} after download: ${err}`);
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
