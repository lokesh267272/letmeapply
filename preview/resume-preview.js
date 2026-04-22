const PREVIEW_STORAGE_KEY = "tailoredResumePreview";
const BACKEND_URL = "http://127.0.0.1:3001/generate-pdf";

let previewState = null;
let currentTemplate = "classic";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  $("downloadPdfBtn").addEventListener("click", handleDownloadPdf);
  $("refreshPreviewBtn").addEventListener("click", loadPreviewState);

  document.querySelectorAll(".tpl-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTemplate = btn.dataset.template;
      document.querySelectorAll(".tpl-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderPreview();
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[PREVIEW_STORAGE_KEY]) return;
    previewState = changes[PREVIEW_STORAGE_KEY].newValue || null;
    renderPreview();
  });

  await loadPreviewState();
});

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

async function loadPreviewState() {
  const data = await storageGet([PREVIEW_STORAGE_KEY]);
  previewState = data[PREVIEW_STORAGE_KEY] || null;
  renderPreview();
}

function renderPreview() {
  const emptyState = $("emptyState");
  const resumeStage = $("resumeStage");
  const resumeMount = $("resumeMount");
  const meta = $("previewMeta");

  if (!previewState?.resumeData) {
    emptyState.classList.remove("hidden");
    resumeStage.classList.add("hidden");
    meta.textContent = "Generate a tailored resume from the popup to see it here.";
    $("downloadPdfBtn").disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  resumeStage.classList.remove("hidden");
  $("downloadPdfBtn").disabled = false;

  resumeMount.innerHTML = ResumeRenderer.buildResumeContentMarkup(previewState.resumeData, { template: currentTemplate });
  document.title = `${ResumeRenderer.getResumeTitle(previewState.resumeData)} - Tailored Resume Preview`;
  meta.textContent = buildPreviewMeta(previewState);
  clearStatus();
}

function buildPreviewMeta(state) {
  const parts = [];

  if (state.job?.title) parts.push(`Tailored for ${state.job.title}`);
  if (state.job?.company) parts.push(`at ${state.job.company}`);
  if (state.generatedAt) {
    const formatted = new Date(state.generatedAt).toLocaleString();
    parts.push(`Generated ${formatted}`);
  }

  return parts.join(" ") || "Your latest tailored resume preview is ready.";
}

function setStatus(message, type = "") {
  const status = $("downloadStatus");
  status.textContent = message;
  status.className = `download-status${type ? ` ${type}` : ""}`;
}

function clearStatus() {
  setStatus("");
}

function sanitizeFileName(name) {
  return String(name || "Tailored-Resume.pdf")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "Tailored-Resume.pdf";
}

function fallbackFileName() {
  const baseName = ResumeRenderer.getResumeTitle(previewState?.resumeData || {});
  const jobTitle = previewState?.job?.title ? ` - ${previewState.job.title}` : "";
  return sanitizeFileName(`${baseName}${jobTitle}.pdf`);
}

async function handleDownloadPdf() {
  if (!previewState?.resumeData) return;

  const button = $("downloadPdfBtn");
  const originalText = button.textContent;
  const fileName = sanitizeFileName(previewState.fileName || fallbackFileName());

  button.disabled = true;
  button.textContent = "Generating...";
  setStatus("Connecting to the local PDF backend...");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName,
        resumeData: previewState.resumeData,
        template: currentTemplate
      })
    });

    if (!response.ok) {
      throw new Error("PDF generation failed");
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    if (chrome.downloads?.download) {
      await chrome.downloads.download({
        url,
        filename: fileName,
        saveAs: true
      });
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    setStatus("PDF downloaded from the local backend.", "success");
  } catch (error) {
    console.error("[Resume preview] PDF download failed", error);
    setStatus("Start the backend first with: cd backend && npm install && npm start", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
