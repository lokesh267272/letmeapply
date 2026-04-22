const COVER_LETTER_KEY = "coverLetterPreview";
const BACKEND_PDF_URL = "http://127.0.0.1:3001/generate-cover-letter-pdf";
const BACKEND_DOCX_URL = "http://127.0.0.1:3001/generate-cover-letter-docx";

let previewState = null;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  $("downloadPdfBtn").addEventListener("click", handleDownloadPdf);
  $("downloadDocxBtn").addEventListener("click", handleDownloadDocx);
  $("refreshPreviewBtn").addEventListener("click", loadPreviewState);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[COVER_LETTER_KEY]) return;
    previewState = changes[COVER_LETTER_KEY].newValue || null;
    renderPreview();
  });

  await loadPreviewState();
});

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

async function loadPreviewState() {
  const data = await storageGet([COVER_LETTER_KEY]);
  previewState = data[COVER_LETTER_KEY] || null;
  renderPreview();
}

function renderPreview() {
  const emptyState = $("emptyState");
  const stage = $("coverLetterStage");
  const mount = $("coverLetterMount");
  const hint = $("clHint");
  const meta = $("previewMeta");

  if (!previewState?.coverLetterText) {
    emptyState.classList.remove("hidden");
    stage.classList.add("hidden");
    hint.classList.add("hidden");
    meta.textContent = "Generate a cover letter from the popup to see it here.";
    $("downloadPdfBtn").disabled = true;
    $("downloadDocxBtn").disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  stage.classList.remove("hidden");
  $("downloadPdfBtn").disabled = false;
  $("downloadDocxBtn").disabled = false;

  mount.innerHTML = CoverLetterRenderer.buildCoverLetterMarkup(previewState, { editable: true });

  // Show hint only when there are placeholders left to edit
  const placeholderCount = mount.querySelectorAll(".cl-placeholder").length;
  hint.classList.toggle("hidden", placeholderCount === 0);

  wirePlaceholderBehavior(mount);

  const namePart = previewState.candidateName || "Cover Letter";
  document.title = `${namePart} - Cover Letter Preview`;

  const parts = [];
  if (previewState.job?.title) parts.push(`For ${previewState.job.title}`);
  if (previewState.job?.company) parts.push(`at ${previewState.job.company}`);
  if (previewState.generatedAt) {
    parts.push(`Generated ${new Date(previewState.generatedAt).toLocaleString()}`);
  }
  meta.textContent = parts.join(" ") || "Your cover letter preview is ready.";
  clearStatus();
}

// Select all text on focus so the user can just type to replace.
// Block Enter so placeholders stay single-line.
function wirePlaceholderBehavior(mount) {
  mount.querySelectorAll(".cl-placeholder").forEach((span) => {
    span.addEventListener("focus", () => {
      const range = document.createRange();
      range.selectNodeContents(span);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    span.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });

    // Remove placeholder styling once user has changed the content
    span.addEventListener("input", () => {
      const content = span.textContent;
      if (content && !content.startsWith("[")) {
        span.classList.add("cl-placeholder--filled");
      } else {
        span.classList.remove("cl-placeholder--filled");
      }
    });
  });
}

// Reads the current text from the DOM (including any edits the user made).
// Paragraphs are separated by double newlines; <br> becomes single newline.
function extractCurrentText() {
  const mount = $("coverLetterMount");
  if (!mount) return previewState?.coverLetterText || "";

  const blocks = [];
  mount.querySelectorAll(".cl-para").forEach((para) => {
    let text = "";
    para.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeName === "BR") {
        text += "\n";
      } else {
        text += node.textContent;
      }
    });
    const trimmed = text.trim();
    if (trimmed) blocks.push(trimmed);
  });

  return blocks.join("\n\n");
}

function setStatus(message, type = "") {
  const el = $("downloadStatus");
  el.textContent = message;
  el.className = `download-status${type ? ` ${type}` : ""}`;
}

function clearStatus() {
  setStatus("");
}

function sanitizeFileName(name) {
  return String(name || "Cover-Letter.pdf")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "Cover-Letter.pdf";
}

function buildPayload(fileName) {
  return {
    fileName,
    coverLetterText: extractCurrentText(),
    candidateName: previewState.candidateName,
    email: previewState.email,
    phone: previewState.phone,
    location: previewState.location,
    generatedAt: previewState.generatedAt
  };
}

async function downloadFile(url, payload, fileName, mimeType, successMsg) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Generation failed");

  const blob = new Blob([await response.arrayBuffer()], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  if (chrome.downloads?.download) {
    await chrome.downloads.download({ url: objectUrl, filename: fileName, saveAs: true });
  } else {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  setStatus(successMsg, "success");
}

async function handleDownloadPdf() {
  if (!previewState?.coverLetterText) return;

  const button = $("downloadPdfBtn");
  const originalText = button.textContent;
  const namePart = previewState.candidateName ? `${previewState.candidateName} - ` : "";
  const jobPart = previewState.job?.title ? `Cover Letter - ${previewState.job.title}` : "Cover Letter";
  const fileName = sanitizeFileName(`${namePart}${jobPart}.pdf`);

  button.disabled = true;
  button.textContent = "Generating...";
  setStatus("Connecting to the local PDF backend...");

  try {
    await downloadFile(BACKEND_PDF_URL, buildPayload(fileName), fileName, "application/pdf", "PDF downloaded successfully.");
  } catch (error) {
    console.error("[Cover letter preview] PDF download failed", error);
    setStatus("Start the backend first with: cd backend && npm install && npm start", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handleDownloadDocx() {
  if (!previewState?.coverLetterText) return;

  const button = $("downloadDocxBtn");
  const originalText = button.textContent;
  const namePart = previewState.candidateName ? `${previewState.candidateName} - ` : "";
  const jobPart = previewState.job?.title ? `Cover Letter - ${previewState.job.title}` : "Cover Letter";
  const fileName = sanitizeFileName(`${namePart}${jobPart}.docx`);

  button.disabled = true;
  button.textContent = "Generating...";
  setStatus("Building DOCX file...");

  try {
    await downloadFile(
      BACKEND_DOCX_URL,
      buildPayload(fileName),
      fileName,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "DOCX downloaded — open in Word to edit."
    );
  } catch (error) {
    console.error("[Cover letter preview] DOCX download failed", error);
    setStatus("Start the backend first with: cd backend && npm install && npm start", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
