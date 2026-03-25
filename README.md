# TypeConverter

A web application to convert files from one format to another.

## Project Structure

```
├── api/
│   └── index.ts
├── public/
│   ├── styles.css
│   └── uploads/
├── views/
│   ├── pages/
│   │   ├── index.ejs
│   │   └── result.ejs
│   └── partials/
│       ├── footer.ejs
│       ├── header.ejs
│       └── navbar.ejs
├── server.js
├── package.json
└── package-lock.json
```

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/KruthikKoundinyas/Typeconverter
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Features

- EJS templating
- Static file serving
- File upload functionality
- Cookie-free: No tracking or session data stored
- Ad-free: Clean interface without advertisements
- Privacy-focused: Files are automatically deleted after download
- Runs locally: All processing happens on your machine
- Supports multiple file formats:
  - Images: JPEG, PNG, WEBP, GIF, BMP, TIFF, ICO, SVG
  - Audio: MP3, WAV, OGG, FLAC

## Supported Conversions

### Image to Image
- JPEG, PNG, WEBP

### Audio to Audio
- MP3, WAV, OGG

## Security & Privacy

- No data collection
- No cookies or tracking
- Temporary file storage only
- Automatic file cleanup (files older than 1 hour)
- All processing done locally
- Path traversal protection on file downloads

## Tech Stack

- Node.js
- Express.js
- Multer for file handling
- FFmpeg for audio processing
- Sharp for image processing
- EJS for templating

## Author

Koundinyas

## License

ISC
