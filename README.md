# TypeConverter

A fast, privacy-focused web application to convert files from one format to another - entirely in your browser with no server uploads.

## ✨ Features

- **Browser-Based Processing** - All conversions happen locally in your browser using WebAssembly (FFmpeg for audio, Sharp for images)
- **No Uploads** - Your files never leave your device
- **No Tracking** - Cookie-free, no analytics, no data collection
- **Ad-Free** - Clean, minimal interface
- **Batch Processing** - Convert multiple files at once
- **Format Preview** - Preview files before and after conversion

## Supported Formats

### Images
JPEG, PNG, WEBP, GIF, BMP, TIFF, ICO, SVG, RAW, TGA

### Audio
MP3, WAV, OGG, FLAC

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Visit `http://localhost:3000` to use the converter.

## 📁 Project Structure

```
TypeConverter/
├── api/
│   └── index.ts           # API endpoints
├── public/
│   ├── styles.css         # Frontend styles
│   └── uploads/           # Temporary file storage
├── views/
│   ├── pages/
│   │   ├── index.ejs      # Main converter page
│   │   └── result.ejs     # Results page
│   └── partials/
│       ├── footer.ejs
│       ├── header.ejs
│       └── navbar.ejs
├── server.js              # Express server
├── main.js                # Client-side logic
├── package.json
└── vercel.json            # Vercel deployment config
```

## 🔒 Privacy & Security

- Files are processed locally in the browser
- Temporary files are automatically cleaned up (files older than 1 hour)
- Path traversal protection on file downloads
- No cookies or session data stored

## 🛠️ Tech Stack

- **Node.js** - Backend runtime
- **Express.js** - Web framework
- **EJS** - Template engine
- **Sharp** - Image processing (server-side)
- **FFmpeg** - Audio/video processing (browser-side via WebAssembly)
- **Multer** - File upload handling

## License

ISC

## 👤 Author

Koundinyas
