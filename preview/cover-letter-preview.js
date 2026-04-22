const COVER_LETTER_KEY = "coverLetterPreview";
const BACKEND_URL = "http://127.0.0.1:3001/generate-cover-letter-pdf";

let previewState = null;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  $("downloadPdfBtn").addEventListener("click", handleDownloadPdf);
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
  const meta = $("previewMeta");

  if (!previewState?.coverLetterText) {
    emptyState.classList.remove("hidden");
    stage.classList.add("hidden");
    meta.textContent = "Generate a cover letter from the popup to see it here.";
    $("downloadPdfBtn").disabled = true;
    return;
  }

  emptyState.classList.add("hidden");
  stage.classList.remove("hidden");
  $("downloadPdfBtn").disabled = false;

  mount.innerHTML = CoverLetterRenderer.buildCoverLetterMarkup(previewState);

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

async function handleDownloadPdf() {
  if (!previewState?.coverLetterText) return;

  const button = $("downloadPdfBtn");
  const originalText = button.textContent;

  const namePart = previewState.candidateName ? `${previewState.candidateName} - ` : "";
  const jobPart = previewState.job?.title
    ? `Cover Letter - ${previewState.job.title}`
    : "Cover Letter";
  const fileName = sanitizeFileName(`${namePart}${jobPart}.pdf`);

  button.disabled = true;
  button.textContent = "Generating...";
  setStatus("Connecting to the local PDF backend...");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        coverLetterText: previewState.coverLetterText,
        candidateName: previewState.candidateName,
        email: previewState.email,
        phone: previewState.phone,
        location: previewState.location,
        generatedAt: previewState.generatedAt
      })
    });

    if (!response.ok) throw new Error("PDF generation failed");

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    if (chrome.downloads?.download) {
      await chrome.downloads.download({ url, filename: fileName, saveAs: true });
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    setStatus("PDF downloaded successfully.", "success");
  } catch (error) {
    console.error("[Cover letter preview] PDF download failed", error);
    setStatus("Start the backend first with: cd backend && npm install && npm start", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
