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

  // Wraps [placeholder] tokens in editable spans (browser preview only).
  // escapeHtml runs first so the span markup itself is never double-escaped.
  function wrapPlaceholders(html) {
    return html.replace(/\[([^\]]+)\]/g, function (_, inner) {
      return (
        '<span class="cl-placeholder" contenteditable="true" spellcheck="false">' +
        "[" + inner + "]" +
        "</span>"
      );
    });
  }

  function textToParagraphs(text, editable) {
    return String(text ?? "")
      .trim()
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const inner = block
          .split(/\n/)
          .map((line) => {
            const escaped = escapeHtml(line.trim());
            return editable ? wrapPlaceholders(escaped) : escaped;
          })
          .join("<br>");
        return `<p class="cl-para">${inner}</p>`;
      })
      .join("");
  }

  function buildCoverLetterMarkup(data, options) {
    const editable = !!(options && options.editable);
    const name = escapeHtml(data.candidateName || "");
    const contactParts = [];
    if (data.email) contactParts.push(escapeHtml(data.email));
    if (data.phone) contactParts.push(escapeHtml(data.phone));
    if (data.location) contactParts.push(escapeHtml(data.location));
    const contact = contactParts.join(" &nbsp;|&nbsp; ");
    const date = escapeHtml(formatDate(data.generatedAt));
    const body = textToParagraphs(data.coverLetterText, editable);

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
