(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const input = $("file-input");
  const dropZone = $("drop-zone");
  const extractButton = $("extract-button");
  const queue = $("queue");
  const fileList = $("file-list");
  const results = $("results");
  const output = $("output-text");
  const MAX_BYTES = 20 * 1024 * 1024;
  let selectedFiles = [];
  let currentWorker = null;
  let activeObjectUrls = [];

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function extension(file) {
    return (file.name.split(".").pop() || "").toLowerCase();
  }

  function addFiles(fileCollection) {
    const allowed = ["png", "jpg", "jpeg", "webp", "bmp", "pdf", "docx", "txt"];
    const incoming = Array.from(fileCollection || []);
    let added = 0;
    incoming.forEach(file => {
      const ext = extension(file);
      if (!allowed.includes(ext)) { toast(`${file.name}: this file type is not supported.`); return; }
      if (file.size > MAX_BYTES) { toast(`${file.name}: please choose a file under 20 MB.`); return; }
      if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) return;
      selectedFiles.push(file); added++;
    });
    renderQueue();
    if (added) toast(`${added} document${added > 1 ? "s" : ""} added.`);
  }

  function renderQueue() {
    fileList.innerHTML = "";
    queue.hidden = selectedFiles.length === 0;
    extractButton.disabled = selectedFiles.length === 0;
    selectedFiles.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "file-row";
      const symbol = document.createElement("div");
      symbol.className = "file-symbol";
      symbol.textContent = extension(file).toUpperCase().slice(0, 4);
      const details = document.createElement("div");
      details.className = "file-details";
      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = file.name;
      const size = document.createElement("div");
      size.className = "file-size";
      size.textContent = formatSize(file.size);
      details.append(name, size);
      const remove = document.createElement("button");
      remove.className = "remove-file";
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => { selectedFiles.splice(index, 1); renderQueue(); });
      row.append(symbol, details, remove);
      fileList.append(row);
    });
  }

  $("browse-button").addEventListener("click", (event) => { event.stopPropagation(); input.click(); });
  dropZone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    input.click();
  });
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); }
  });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, e => {
    e.preventDefault(); dropZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, e => {
    e.preventDefault(); dropZone.classList.remove("dragover");
  }));
  dropZone.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  $("clear-files").addEventListener("click", () => { selectedFiles = []; renderQueue(); });

  function setProgress(percent, message) {
    $("progress-wrap").hidden = false;
    $("progress-bar").style.width = `${Math.max(0, Math.min(100, percent))}%`;
    $("progress-percent").textContent = `${Math.round(percent)}%`;
    $("progress-message").textContent = message;
  }

  async function getOcrWorker(language, onProgress) {
    if (!window.Tesseract) throw new Error("OCR library did not load. Check your internet connection and reload.");
    if (currentWorker) { try { await currentWorker.terminate(); } catch (_) {} }
    currentWorker = await Tesseract.createWorker(language, 1, {
      logger: info => {
        if (info.status === "recognizing text") onProgress(info.progress || 0);
      },
      workerPath: "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/worker.min.js",
      corePath: "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js-core/5.0.0/tesseract-core.wasm.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0"
    });
    return currentWorker;
  }

  async function recognizeImage(imageSource, worker, progressCallback) {
    const result = await worker.recognize(imageSource);
    if (progressCallback) progressCallback();
    return result.data.text || "";
  }

  async function imageFromPdfPage(page, scale = 1.8) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  }

  async function extractPdf(file, worker, onProgress) {
    if (!window.pdfjsLib) throw new Error("PDF reader did not load. Check your internet connection and reload.");
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const parts = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      onProgress((pageNo - 1) / pdf.numPages, `Reading PDF page ${pageNo} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNo);
      const textContent = await page.getTextContent();
      const embeddedText = textContent.items.map(item => item.str || "").join(" ").trim();
      if (embeddedText.length > 25) {
        parts.push(`--- Page ${pageNo} ---\n${embeddedText}`);
      } else {
        const canvas = await imageFromPdfPage(page, 2);
        const text = await recognizeImage(canvas, worker);
        parts.push(`--- Page ${pageNo} ---\n${text}`);
        canvas.width = 0; canvas.height = 0;
      }
      onProgress(pageNo / pdf.numPages, `Processed PDF page ${pageNo} of ${pdf.numPages}`);
    }
    return parts.join("\n\n");
  }

  async function extractDocx(file) {
    if (!window.mammoth) throw new Error("DOCX reader did not load. Check your internet connection and reload.");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value || "";
  }

  async function processFile(file, worker, onProgress) {
    const ext = extension(file);
    if (["png", "jpg", "jpeg", "webp", "bmp"].includes(ext)) {
      return await recognizeImage(file, worker, () => onProgress(1, `Finished ${file.name}`));
    }
    if (ext === "pdf") return await extractPdf(file, worker, onProgress);
    if (ext === "docx") return await extractDocx(file);
    if (ext === "txt") return await file.text();
    throw new Error(`Unsupported format: ${ext}`);
  }

  extractButton.addEventListener("click", async () => {
    if (!selectedFiles.length) return;
    extractButton.disabled = true;
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
    output.value = "";
    $("result-status").textContent = "Processing";
    const language = $("language-select").value;
    const allText = [];
    try {
      const needsOcr = selectedFiles.some(f => ["png","jpg","jpeg","webp","bmp","pdf"].includes(extension(f)));
      let worker = null;
      if (needsOcr) {
        setProgress(0, "Loading recognition engine and language data…");
        worker = await getOcrWorker(language, p => setProgress(p * 5, "Loading OCR engine…"));
      }
      const total = selectedFiles.length;
      for (let i = 0; i < total; i++) {
        const file = selectedFiles[i];
        $("result-filename").textContent = file.name;
        const start = (i / total) * 100;
        const span = 100 / total;
        const text = await processFile(file, worker, (p, message) => {
          setProgress(start + p * span, message || `Processing ${file.name}`);
        });
        allText.push(`===== ${file.name} =====\n${text.trim()}`);
        output.value = allText.join("\n\n");
        output.scrollTop = output.scrollHeight;
      }
      setProgress(100, "All documents processed.");
      $("result-status").textContent = "Ready to review";
      toast("Extraction complete. Please review the result.");
    } catch (error) {
      console.error(error);
      $("result-status").textContent = "Needs attention";
      toast(error.message || "Something went wrong while processing.");
      if (!output.value) output.value = `Could not complete extraction.\n\n${error.message || error}`;
    } finally {
      extractButton.disabled = selectedFiles.length === 0;
      if (currentWorker) { try { await currentWorker.terminate(); } catch (_) {} currentWorker = null; }
    }
  });

  $("copy-button").addEventListener("click", async () => {
    if (!output.value) return toast("There is no text to copy yet.");
    try {
      await navigator.clipboard.writeText(output.value);
      toast("Text copied to clipboard.");
    } catch (_) {
      output.select();
      document.execCommand("copy");
      toast("Text copied.");
    }
  });

  $("download-button").addEventListener("click", () => {
    if (!output.value) return toast("There is no text to download yet.");
    const blob = new Blob([output.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "glyphora-extracted-text.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  window.addEventListener("beforeunload", () => {
    if (currentWorker) currentWorker.terminate();
    activeObjectUrls.forEach(URL.revokeObjectURL);
  });
})();
