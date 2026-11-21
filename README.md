# Glyphora

A privacy-minded, browser-based document text extraction app built with plain HTML, CSS and JavaScript.

## Features

- Image OCR for PNG, JPG/JPEG, WEBP and BMP using Tesseract.js.
- PDF text extraction with PDF.js; scanned PDF pages are rendered and OCR'd.
- DOCX text extraction with Mammoth.js.
- TXT file reading.
- Multiple file queue, editable results, copy and TXT download.
- English, Hindi and Telugu language selection (Tesseract traineddata availability and device performance may vary).
- No account, app database, document upload endpoint or cloud document history.

## Deploy to Vercel

1. Upload all files in this folder to the root of a GitHub repository. Keep `index.html`, `about.html`, `privacy.html`, `style.css`, `responsive.css`, and `app.js` together in the repository root.
2. In Vercel, import the GitHub repository.
3. Select **Other** as the framework preset if prompted.
4. Leave Build Command empty.
5. Leave Output Directory as `.` (or the root/default static output).
6. Deploy.

No build step or environment variables are required.

## Run locally

Use any static file server from this directory, for example:

```bash
npx serve .
```

Opening `index.html` directly with `file://` may prevent some browser workers and PDF functionality from working correctly. Use localhost or HTTPS. All app HTML, CSS and JavaScript files are in the project root; there are no local `css/` or `js/` subfolders.

## Privacy and external assets

Document bytes and extracted text are processed in the browser. This starter loads Tesseract.js, PDF.js, Mammoth.js and OCR language data from CDNs, and loads fonts from Google Fonts. Those providers may receive standard network metadata. The app does not intentionally send document contents to them.

For a stricter deployment, self-host and pin the JavaScript libraries, Tesseract core/worker files, traineddata files and fonts. Do not add analytics, remote OCR APIs or document-upload endpoints if maintaining the local-only design.

## Supported formats

- PNG, JPG/JPEG, WEBP, BMP: OCR.
- PDF: embedded text extraction first; OCR for pages with little/no embedded text.
- DOCX: text extraction.
- TXT: direct reading.

TIFF, legacy DOC, XLS/XLSX, PPT/PPTX, password-protected PDFs and handwritten text are not supported in this initial release. Tables and complex layouts may not retain their original structure. DOCX extraction is text-only.

## Accuracy and performance

No OCR system can guarantee zero mistakes. Results depend on image quality, skew, language, fonts, handwriting and layout. Review important content manually. Large PDFs and combined language models can consume substantial memory and battery on mobile devices. Start with smaller documents when testing.

## License

MIT. See `LICENSE`.
