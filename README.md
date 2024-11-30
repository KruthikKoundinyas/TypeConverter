# TypeConverter
Project to convert the files of one type to the other

# Express Website Project
A web application built with Express.js.

## Project Structure
```
├── typeConverter/
├── node_modules/
├── public/
│   └── uploads/
│   └── styles.css
├── views/
│   ├── pages/
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

The application will be available at `NOTHING YET; LATER IN VERCEL`

## Features
- EJS templating
- Static file serving
- File upload functionality
- Cookie free: No tracking or session data stored
- Ad free: Clean interface without advertisements
- Privacy focused: Files are automatically deleted after returning to home page
- Runs locally: All processing happens on your machine
- Supports multiple file formats:
  - Images: JPG, PNG, WEBP, GIF
  - Videos: MP4, AVI, MOV, WEBM
  - More formats coming soon

## Security & Privacy
- No data collection
- No cookies or tracking
- Temporary file storage only
- Automatic file cleanup
- All processing done locally

## Tech Stack
- Node.js
- Express.js
- Multer for file handling
- FFmpeg for video processing
- Sharp for image processing
- EJS for templating

## Author
Koundinyas

## License
ISC
