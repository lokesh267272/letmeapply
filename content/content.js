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

  // ── EXTRACTORS ──

  function extractLinkedIn() {
    const title = getText([
      '.jobs-unified-top-card__job-title',
      '.t-24.t-bold.inline',
      '[data-test-id="job-title"]',
      'h1.t-24',
      '.job-details-jobs-unified-top-card__job-title h1'
    ]);

    const company = getText([
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '[data-test-id="job-company-name"]',
      '.job-details-jobs-unified-top-card__company-name',
      '.topcard__org-name-link'
    ]);

    const location = getText([
      '.jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__workplace-type',
      '.topcard__flavor--bullet',
      '.job-details-jobs-unified-top-card__primary-description-container .tvm__text'
    ]);

    const description = getAllText([
      '.jobs-description__content .jobs-box__html-content',
      '.jobs-description-content__text',
      '#job-details',
      '.jobs-description',
      '.description__text',
      '[data-test-id="job-description"]'
    ]);

    return {
      platform: 'LinkedIn',
      title: title || document.title.split(' | ')[0],
      company,
      location,
      description,
      url: location.href
    };
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

    return {
      platform: 'Naukri',
      title: title || document.title.split(' - ')[0],
      company,
      location,
      description,
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
