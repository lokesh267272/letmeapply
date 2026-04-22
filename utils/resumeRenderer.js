(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ResumeRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeResumeData(input) {
    if (input && typeof input === "object" && input.resumeData && typeof input.resumeData === "object") {
      return input.resumeData;
    }
    return input || {};
  }

  function sanitizeUrl(url) {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw)) return raw;
    return `https://${raw}`;
  }

  function makeLink(url, label) {
    const href = sanitizeUrl(url);
    const text = escapeHtml(label || url || "");
    if (!href) return text;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${text}</a>`;
  }

  function joinBullets(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  }

  function renderBulletSection(items, compact) {
    const bullets = joinBullets(items);
    if (!bullets) return "";
    return `<ul class="bullet-list${compact ? " compact" : ""}">${bullets}</ul>`;
  }

  function renderSkills(skills) {
    const rows = [
      ["Programming Languages", skills?.programmingLanguages],
      ["Core CS Concepts", skills?.csConcepts],
      ["Web Development", skills?.webDevelopment],
      ["Databases", skills?.databases],
      ["Cloud & Platforms", skills?.cloudPlatforms],
      ["Machine Learning & AI", skills?.mlAI],
      ["Mobile Development", skills?.mobileDevelopment]
    ];

    return rows
      .filter(([, list]) => Array.isArray(list) && list.some(Boolean))
      .map(([label, list]) => {
        const value = list.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
        return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`;
      })
      .join("");
  }

  function formatDateRange(startDate, endDate, current) {
    const start = String(startDate ?? "").trim();
    const end = current ? "Present" : String(endDate ?? "").trim();
    if (start && end) return `${escapeHtml(start)} - ${escapeHtml(end)}`;
    if (start) return escapeHtml(start);
    if (end) return escapeHtml(end);
    return "";
  }

  function renderEntryRow(main, side) {
    return `
      <div class="entry-row">
        <div class="entry-main">${main}</div>
        <div class="entry-side">${side || ""}</div>
      </div>
    `;
  }

  function renderEducation(education) {
    return (Array.isArray(education) ? education : [])
      .filter((entry) => entry && (entry.school || entry.degree || entry.cgpa || (entry.bullets || []).length))
      .map((entry) => {
        const leftParts = [];
        if (entry.school) leftParts.push(`<strong>${escapeHtml(entry.school)}</strong>`);
        if (entry.degree) leftParts.push(escapeHtml(entry.degree));
        if (entry.location) leftParts.push(escapeHtml(entry.location));

        const extraBullets = [];
        if (entry.cgpa) extraBullets.push(`CGPA / Percentage: ${entry.cgpa}`);
        if (Array.isArray(entry.bullets)) extraBullets.push(...entry.bullets);

        return `
          <article class="entry">
            ${renderEntryRow(leftParts.join(", "), formatDateRange(entry.startDate, entry.endDate, entry.current))}
            ${renderBulletSection(extraBullets, true)}
          </article>
        `;
      })
      .join("");
  }

  function renderExperience(experience) {
    return (Array.isArray(experience) ? experience : [])
      .filter((entry) => entry && (entry.title || entry.company || (entry.bullets || []).length))
      .map((entry) => {
        const title = entry.title ? `<strong>${escapeHtml(entry.title)}</strong>` : "";
        const company = entry.company ? escapeHtml(entry.company) : "";
        const location = entry.location ? ` - ${escapeHtml(entry.location)}` : "";
        const left = [title, company].filter(Boolean).join(", ") + location;

        return `
          <article class="entry">
            ${renderEntryRow(left, formatDateRange(entry.startDate, entry.endDate, entry.current))}
            ${renderBulletSection(entry.bullets)}
          </article>
        `;
      })
      .join("");
  }

  function renderProjects(projects) {
    return (Array.isArray(projects) ? projects : [])
      .filter((entry) => entry && (entry.name || entry.organization || entry.link || (entry.bullets || []).length))
      .map((entry) => {
        const leftParts = [];
        if (entry.name) leftParts.push(`<strong>${escapeHtml(entry.name)}</strong>`);
        if (entry.organization) leftParts.push(escapeHtml(entry.organization));
        if (entry.location) leftParts.push(escapeHtml(entry.location));

        let right = "";
        if (entry.link) {
          right = makeLink(entry.link, String(entry.link).replace(/^https?:\/\//i, ""));
        } else {
          right = formatDateRange(entry.startDate, entry.endDate, entry.current);
        }

        return `
          <article class="entry">
            ${renderEntryRow(leftParts.join(" - "), right)}
            ${renderBulletSection(entry.bullets)}
          </article>
        `;
      })
      .join("");
  }

  function renderSimpleList(items, formatter) {
    const normalized = (Array.isArray(items) ? items : [])
      .map((item) => formatter ? formatter(item) : String(item ?? "").trim())
      .filter(Boolean);
    return renderBulletSection(normalized, false);
  }

  function renderLanguages(items) {
    return renderSimpleList(items, (item) => {
      const name = String(item?.name ?? "").trim();
      const proficiency = String(item?.proficiency ?? "").trim();
      if (!name) return "";
      return proficiency ? `${name} - ${proficiency}` : name;
    });
  }

  function splitName(personal, fallbackName) {
    const first = String(personal?.firstName ?? "").trim();
    const last = String(personal?.lastName ?? "").trim();
    const full = [first, last].filter(Boolean).join(" ").trim();
    return full || String(fallbackName ?? "").trim() || "Candidate";
  }

  function buildContactLine(resume) {
    const personal = resume.personal || {};
    const segments = [];

    if (personal.location) segments.push(`<span>${escapeHtml(personal.location)}</span>`);
    if (personal.email) segments.push(makeLink(`mailto:${personal.email}`, personal.email));
    if (personal.phone) segments.push(makeLink(`tel:${personal.phone}`, personal.phone));
    if (personal.linkedin) segments.push(makeLink(personal.linkedin, personal.linkedin.replace(/^https?:\/\//i, "")));
    if (personal.github) segments.push(makeLink(personal.github, personal.github.replace(/^https?:\/\//i, "")));

    if (!segments.length) return "";

    return `
      <div class="contact-line">
        ${segments.map((segment, index) => `${index ? '<span class="sep">|</span>' : ""}${segment}`).join("")}
      </div>
    `;
  }

  function renderSection(title, body) {
    if (!body || !String(body).trim()) return "";
    return `
      <section class="resume-section">
        <h2>${escapeHtml(title)}</h2>
        ${body}
      </section>
    `;
  }

  function getResumeTitle(input) {
    const resume = normalizeResumeData(input);
    const personal = resume.personal || {};
    return splitName(personal, input?.name || resume?.name);
  }

  function buildResumeContentMarkup(input, options) {
    const resume = normalizeResumeData(input);
    const template = (options && options.template) || "classic";
    const fullName = getResumeTitle(input);
    const summary = String(resume.summary ?? input?.summary ?? "").trim();
    const skillsMarkup = renderSkills(resume.skills || {});

    return `
      <main class="page template-${escapeHtml(template)}">
        <header class="resume-header">
          <h1>${escapeHtml(fullName)}</h1>
          ${buildContactLine(resume)}
        </header>

        ${renderSection("Career Objective", summary ? `<p class="objective">${escapeHtml(summary)}</p>` : "")}
        ${renderSection("Skills", skillsMarkup ? `<ul class="bullet-list">${skillsMarkup}</ul>` : "")}
        ${renderSection("Education", renderEducation(resume.education))}
        ${renderSection("Experience", renderExperience(resume.experience))}
        ${renderSection("Projects", renderProjects(resume.projects))}
        ${renderSection("Achievements", renderSimpleList(resume.achievements))}
        ${renderSection("Certifications", renderSimpleList(resume.certifications))}
        ${renderSection("Languages", renderLanguages(resume.languages))}
        ${renderSection("Publications", renderSimpleList(resume.publications))}
      </main>
    `;
  }

  return {
    buildResumeContentMarkup,
    getResumeTitle,
    normalizeResumeData
  };
});
