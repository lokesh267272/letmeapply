(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CoverLetterRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(isoString) {
    const d = isoString ? new Date(isoString) : new Date();
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  function textToParagraphs(text) {
    return String(text ?? "")
      .trim()
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const inner = block
          .split(/\n/)
          .map((line) => escapeHtml(line.trim()))
          .join("<br>");
        return `<p class="cl-para">${inner}</p>`;
      })
      .join("");
  }

  function buildCoverLetterMarkup(data) {
    const name = escapeHtml(data.candidateName || "");
    const contactParts = [];
    if (data.email) contactParts.push(escapeHtml(data.email));
    if (data.phone) contactParts.push(escapeHtml(data.phone));
    if (data.location) contactParts.push(escapeHtml(data.location));
    const contact = contactParts.join(" &nbsp;|&nbsp; ");
    const date = escapeHtml(formatDate(data.generatedAt));
    const body = textToParagraphs(data.coverLetterText);

    return `
      <main class="cl-page">
        <header class="cl-header">
          ${name ? `<div class="cl-name">${name}</div>` : ""}
          ${contact ? `<div class="cl-contact">${contact}</div>` : ""}
        </header>
        <div class="cl-date">${date}</div>
        <div class="cl-body">${body}</div>
      </main>
    `;
  }

  return { buildCoverLetterMarkup };
});
