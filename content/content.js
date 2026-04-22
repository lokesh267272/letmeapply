// ── LETMEAPPLY CONTENT SCRIPT ──
// Detects and extracts job details from LinkedIn, Naukri, Indeed, and universal pages

(function () {
  'use strict';

  function getHostname() {
    return window.location.hostname.replace('www.', '');
  }

  // ── PLATFORM DETECTORS ──

  function isLinkedIn() {
    return getHostname().includes('linkedin.com') &&
      (location.pathname.includes('/jobs/') || location.pathname.includes('/job/'));
  }

  function isNaukri() {
    return getHostname().includes('naukri.com');
  }

  function isIndeed() {
    return getHostname().includes('indeed.com') &&
      (location.pathname.includes('viewjob') || location.search.includes('jk=') || location.pathname.includes('/jobs'));
  }

  // ── TEXT HELPER ──

  function getText(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.innerText.trim();
    }
    return '';
  }

  function getAllText(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 50) return el.innerText.trim();
    }
    return '';
  }

  function getLongestTextFromElements(elements, minLength = 80) {
    let best = '';
    (elements || []).forEach((el) => {
      const text = (el?.innerText || '').trim();
      if (text.length > best.length && text.length >= minLength) {
        best = text;
      }
    });
    return best;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  // ── IFRAME-AWARE HELPERS ──

  function getAllDocs() {
    const docs = [document];
    try {
      const frames = Array.from(document.querySelectorAll('iframe'));
      for (const frame of frames) {
        try {
          const cd = frame.contentDocument;
          if (cd && cd.body) docs.push(cd);
        } catch { /* cross-origin, skip */ }
      }
    } catch { /* querySelectorAll failed */ }
    return docs;
  }

  function queryAcrossDocs(selector) {
    for (const doc of getAllDocs()) {
      try {
        const el = doc.querySelector(selector);
        if (el) return el;
      } catch { /* bad selector or access error */ }
    }
    return null;
  }

  function queryAllAcrossDocs(selector) {
    const results = [];
    for (const doc of getAllDocs()) {
      try {
        doc.querySelectorAll(selector).forEach(el => results.push(el));
      } catch { /* skip */ }
    }
    return results;
  }

  function getLinkedInDetailRoot() {
    const roots = [
      '.jobs-search__job-details--container',
      '.jobs-search__right-rail',
      '.job-view-layout',
      '.scaffold-layout__detail',
      '.jobs-details',
      '.jobs-unified-top-card'
    ];

    for (const doc of getAllDocs()) {
      for (const sel of roots) {
        try {
          const el = doc.querySelector(sel);
          if (el && cleanText(el.innerText).length > 120) return el;
        } catch { /* skip */ }
      }
    }

    // Fall back to whichever doc body has the most content
    let bestBody = document.body;
    for (const doc of getAllDocs()) {
      try {
        if ((doc.body?.innerText || '').length > (bestBody?.innerText || '').length) {
          bestBody = doc.body;
        }
      } catch { /* cross-origin */ }
    }
    return bestBody;
  }

  function getTextFromWithin(root, selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const sel of selectors) {
      const el = root?.querySelector(sel);
      const text = cleanText(el?.innerText || '');
      if (text) return text;
    }
    return '';
  }

  function scopedQuery(root, selector) {
    if (!root) return null;
    try { return root.querySelector(selector); } catch { return null; }
  }

  function getLinkedInTitleFallback(root) {
    const candidates = Array.from(root.querySelectorAll('h1, h2, h3, a, span, div'))
      .map((el) => cleanText(el.innerText))
      .filter((text) => {
        if (!text) return false;
        if (text.length < 4 || text.length > 120) return false;
        const lower = text.toLowerCase();
        if (lower.includes('about the job')) return false;
        if (lower.includes('meet the hiring team')) return false;
        if (lower.includes('show all')) return false;
        if (lower.includes('people you may')) return false;
        if (lower.includes('top job picks')) return false;
        return true;
      });

    return candidates[0] || '';
  }

  function getLinkedInCompanyFallback(root) {
    const text = cleanText(root.innerText);
    if (!text) return '';

    const lines = text.split('\n').map(cleanText).filter(Boolean);
    const aboutIndex = lines.findIndex((line) => line.toLowerCase().includes('about the job'));

    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      if (lower.includes('actively reviewing applicants')) continue;
      if (lower.includes('easy apply')) continue;
      if (lower.includes('promoted by')) continue;
      if (lower.includes('on-site') || lower.includes('remote') || lower.includes('hybrid')) continue;
      if (lower.includes('show all')) continue;
      if (/^\(?\d+\)?\s+top job picks/i.test(line)) continue;
      if (aboutIndex !== -1 && i >= aboutIndex) break;
      if (line.length >= 2 && line.length <= 80) return line;
    }

    return '';
  }

  function getLinkedInLocationFallback(root) {
    const text = cleanText(root.innerText);
    if (!text) return '';

    const lines = text.split('\n').map(cleanText).filter(Boolean);
    const locationLine = lines.find((line) => {
      const lower = line.toLowerCase();
      return (
        lower.includes(' on-site') ||
        lower.includes(' remote') ||
        lower.includes(' hybrid') ||
        /\b(india|united states|canada|uk|bengaluru|bangalore|hyderabad|chennai|pune|mumbai|delhi)\b/i.test(line)
      );
    });

    return locationLine || '';
  }

  function getLinkedInDescriptionFallback() {
    const panel = getLinkedInDetailRoot();
    if (!panel) return '';

    const contentBlocks = panel.querySelectorAll('article, section, div');
    const best = getLongestTextFromElements(
      Array.from(contentBlocks).filter((el) => {
        const text = cleanText(el?.innerText || '').toLowerCase();
        return text.length > 150 && (
          text.includes('about the job') ||
          text.includes('responsibilities') ||
          text.includes('qualifications') ||
          text.includes('requirements') ||
          text.includes('about us') ||
          text.includes('about the role')
        );
      }),
      150
    );

    if (best) return best;

    const panelText = cleanText(panel.innerText);
    const aboutIndex = panelText.toLowerCase().indexOf('about the job');
    if (aboutIndex !== -1) {
      return panelText.slice(aboutIndex).trim();
    }

    return '';
  }

  // ── EXTRACTORS ──

  function extractLinkedIn() {
    let title = '', company = '', location = '', description = '', recruiter = '', recruiterCompany = '';

    // ── TIER 1: SDUI selectors (new LinkedIn layout) ──
    const sduiRoot = queryAcrossDocs(
      'div[data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails"]'
    );

    if (sduiRoot) {
      const titleEl = scopedQuery(sduiRoot, 'a[href*="/jobs/view/"]');
      title = titleEl ? cleanText(titleEl.innerText) : '';

      const companyLinks = Array.from(sduiRoot.querySelectorAll('a[href*="/company/"]'));
      recruiterCompany = companyLinks.map(el => cleanText(el.innerText)).find(t => t) || '';

      location = (() => {
        const lines = (sduiRoot.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
        return lines.find(line => {
          const l = line.toLowerCase();
          return l.includes('on-site') || l.includes('remote') || l.includes('hybrid') ||
            /\b(india|united states|canada|uk|bengaluru|bangalore|hyderabad|chennai|pune|mumbai|delhi)\b/i.test(line);
        }) || '';
      })();

      const recruiterBlock = scopedQuery(
        sduiRoot,
        'div[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.peopleWhoCanHelp"]'
      );
      if (recruiterBlock) {
        const profileLink = scopedQuery(recruiterBlock, 'a[href*="/in/"]');
        if (profileLink) recruiter = cleanText(profileLink.innerText);
      }

      const descBlock = scopedQuery(
        sduiRoot,
        'div[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]'
      );
      if (descBlock) {
        const expandable = scopedQuery(descBlock, 'span[data-testid="expandable-text-box"]');
        const textEl = expandable || descBlock;
        description = (textEl.innerText || '').trim().replace(/^about the job\s*/i, '').trim();
      }
    }

    // ── TIER 2: Legacy (Ember/non-SDUI) selectors — fill any gaps ──
    if (!title) {
      const titleEl = queryAcrossDocs([
        'h1.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title a'
      ].join(', '));
      title = titleEl ? cleanText(titleEl.innerText) : '';
    }

    if (!recruiterCompany) {
      const companyEl = queryAcrossDocs([
        '.job-details-jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name'
      ].join(', '));
      recruiterCompany = companyEl ? cleanText(companyEl.innerText) : '';
    }

    if (!location) {
      const locEl = queryAcrossDocs([
        '.job-details-jobs-unified-top-card__primary-description-container',
        '.jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__workplace-type'
      ].join(', '));
      location = locEl ? cleanText(locEl.innerText) : '';
    }

    if (!description) {
      const descEl = queryAcrossDocs([
        '.jobs-description__content',
        '.jobs-description-content',
        '.jobs-box__html-content',
        '.jobs-description__container',
        '.jobs-description'
      ].join(', '));
      if (descEl) {
        description = (descEl.innerText || '').trim().replace(/^about the job\s*/i, '').trim();
      }
    }

    // ── TIER 3: Text-based fallbacks — last resort ──
    const fallbackRoot = getLinkedInDetailRoot();

    if (!title) title = getLinkedInTitleFallback(fallbackRoot);
    if (!recruiterCompany) recruiterCompany = getLinkedInCompanyFallback(fallbackRoot);
    if (!location) location = getLinkedInLocationFallback(fallbackRoot);
    if (!description) description = getLinkedInDescriptionFallback();

    if (!recruiter) recruiter = recruiterCompany;

    return {
      platform: 'LinkedIn',
      title: title || document.title.split(' | ')[0],
      company: recruiterCompany,
      location,
      description,
      recruiter,
      recruiterCompany,
      url: window.location.href
    };
  }

  function extractNaukriDetailRows(containerEl) {
    const rows = {};
    if (!containerEl) return rows;
    containerEl.querySelectorAll('div[class*="styles_details__"]').forEach(row => {
      const label = row.querySelector('label');
      const span = row.querySelector('span');
      if (!label || !span) return;
      const key = cleanText(label.innerText).replace(/:$/, '');
      const anchors = Array.from(span.querySelectorAll('a'));
      const value = anchors.length > 0
        ? anchors.map(a => cleanText(a.innerText)).filter(Boolean).join(', ')
        : cleanText(span.innerText);
      if (key && value) rows[key] = value;
    });
    return rows;
  }

  function extractNaukri() {
    const title = getText([
      'h1.styles_jd-header-title__rZwM1',
      'h1[class*="jd-header-title"]',
      '.jd-header-title',
      'h1',
    ]);

    const company = getText([
      '.jd-header-comp-name a',
      '.jd-header-comp-name',
      '[class*="comp-name"]',
      '.styles_jd-header-comp-name__MvqAT a',
      '.styles_jd-header-comp-name__MvqAT'
    ]);

    const location = getText([
      '[class*="location"] span',
      '.styles_jhc__loc__W6Xbj span',
      '[class*="locationWdgt"] li',
      '.loc span'
    ]);

    const description = getAllText([
      '.styles_JD-section__nR4gB',
      '.job-desc',
      '[class*="dang-inner-html"]',
      '[class*="JD-section"]',
      '.jd-desc'
    ]);

    // ── Role / Industry / Department / Employment / Role Category ──
    const otherDetailsEl = document.querySelector('div[class*="styles_other-details__"]');
    const otherDetails = extractNaukriDetailRows(otherDetailsEl);
    const role          = otherDetails['Role']            || '';
    const industryType  = otherDetails['Industry Type']   || '';
    const department    = otherDetails['Department']      || '';
    const employmentType = otherDetails['Employment Type'] || '';
    const roleCategory  = otherDetails['Role Category']   || '';

    // ── Education ──
    const educationEl = document.querySelector('div[class*="styles_education__"]');
    const educationRows = extractNaukriDetailRows(educationEl);
    const education = {};
    if (educationRows['UG'])        education.ug        = educationRows['UG'];
    if (educationRows['PG'])        education.pg        = educationRows['PG'];
    if (educationRows['Doctorate']) education.doctorate = educationRows['Doctorate'];

    // ── Key Skills ──
    const skillContainerEl = document.querySelector('div[class*="styles_key-skill__"]');
    const keySkills = [];
    if (skillContainerEl) {
      skillContainerEl.querySelectorAll('a[class*="styles_chip__"]').forEach(chip => {
        const nameEl = chip.querySelector('span');
        if (!nameEl) return;
        const name = cleanText(nameEl.innerText);
        if (!name) return;
        const preferred = !!chip.querySelector('i.ni-icon-jd-save');
        keySkills.push({ name, preferred });
      });
    }

    // Append structured metadata to description so Gemini receives full context
    const metaParts = [];
    if (role)           metaParts.push(`Role: ${role}`);
    if (industryType)   metaParts.push(`Industry Type: ${industryType}`);
    if (department)     metaParts.push(`Department: ${department}`);
    if (employmentType) metaParts.push(`Employment Type: ${employmentType}`);
    if (roleCategory)   metaParts.push(`Role Category: ${roleCategory}`);
    if (Object.keys(education).length > 0) {
      const eduStr = Object.entries(education).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(' | ');
      metaParts.push(`Education: ${eduStr}`);
    }
    if (keySkills.length > 0) {
      metaParts.push(`Key Skills: ${keySkills.map(s => s.name).join(', ')}`);
    }
    const metaBlock = metaParts.length > 0
      ? '\n\n--- Job Metadata ---\n' + metaParts.join('\n')
      : '';

    return {
      platform: 'Naukri',
      title: title || document.title.split(' - ')[0],
      company,
      location,
      description: description + metaBlock,
      role,
      industry_type: industryType,
      department,
      employment_type: employmentType,
      role_category: roleCategory,
      education,
      key_skills: keySkills,
      url: window.location.href
    };
  }

  function extractIndeed() {
    const title = getText([
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1.jobsearch-JobInfoHeader-title',
      '.jobsearch-JobInfoHeader-title',
      'h1',
    ]);

    const company = getText([
      '[data-testid="inlineHeader-companyName"] a',
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-CompanyInfoContainer .icl-u-lg-mr--sm',
      '[data-company-name]',
      '.jobsearch-InlineCompanyRating-companyHeader'
    ]);

    const location = getText([
      '[data-testid="job-location"]',
      '[data-testid="inlineHeader-companyLocation"]',
      '.jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-locationWrap',
      '.icl-u-xs-mt--xs'
    ]);

    const description = getAllText([
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[data-testid="jobsearch-JobComponent-description"]',
      '.job-description-container'
    ]);

    return {
      platform: 'Indeed',
      title: title || document.title.split(' - ')[0],
      company,
      location,
      description,
      url: window.location.href
    };
  }

  function extractUniversal() {
    // Try to find job title from h1 or title tag
    const title = getText(['h1', 'h2', '.job-title', '[class*="job-title"]', '[class*="jobtitle"]']) ||
      document.title.split(/[-|–]/)[0].trim();

    // Try to find company name
    const company = getText([
      '[class*="company"]', '[class*="employer"]', '[class*="org-name"]',
      '[itemprop="hiringOrganization"]'
    ]);

    // Find largest text block (likely the job description)
    let bestBlock = '';
    const candidates = document.querySelectorAll('div, section, article');
    for (const el of candidates) {
      const text = el.innerText || '';
      if (
        text.length > bestBlock.length &&
        text.length > 200 &&
        text.length < 15000 &&
        el.children.length < 50
      ) {
        // Check if it looks like a job description
        const keywords = ['responsibilities', 'requirements', 'qualifications', 'experience',
          'skills', 'role', 'position', 'apply', 'job', 'duties'];
        const lower = text.toLowerCase();
        const kwCount = keywords.filter(k => lower.includes(k)).length;
        if (kwCount >= 2) bestBlock = text;
      }
    }

    return {
      platform: 'Unknown',
      title,
      company,
      location: '',
      description: bestBlock,
      url: window.location.href
    };
  }

  // ── MAIN EXTRACTION ──

  function extractJobData() {
    try {
      let data;
      if (isLinkedIn()) data = extractLinkedIn();
      else if (isNaukri()) data = extractNaukri();
      else if (isIndeed()) data = extractIndeed();
      else data = extractUniversal();

      // Validate: must have at least a title or description
      if (!data.title && !data.description) {
        return { success: false, reason: 'no_job_found' };
      }

      // Truncate description to 4000 chars to keep API calls reasonable
      if (data.description && data.description.length > 4000) {
        data.description = data.description.substring(0, 4000) + '\n[...truncated]';
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, reason: 'extraction_error', error: err.message };
    }
  }

  // ── MESSAGE LISTENER ──

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractJob') {
      const result = extractJobData();
      sendResponse(result);
    }
    return true; // Keep channel open for async
  });

})();
