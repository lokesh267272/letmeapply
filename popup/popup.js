// ── LETMEAPPLY POPUP SCRIPT ──

// ── STATE ──
let jobData = null;
let profile = {};
let apiKey = '';

// ── DOM REFS ──
const $ = id => document.getElementById(id);
const storageGet = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
const storageSet = items => new Promise(resolve => chrome.storage.local.set(items, resolve));
const TAILORED_PREVIEW_KEY = 'tailoredResumePreview';
const COVER_LETTER_KEY = 'coverLetterPreview';

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  setupTabs();
  setupSettings();
  setupActions();
  setupJobDescEditing();
  await restoreTailoredResumeState();
  await restoreCoverLetterState();
  setupResumeBuilder();
  detectJob();
});

// ── LOAD PROFILE ──
async function loadProfile() {
  return new Promise(resolve => {
    chrome.storage.local.get(['apiKey', 'name', 'email', 'resume'], (data) => {
      apiKey = data.apiKey || '';
      profile = {
        name: data.name || '',
        email: data.email || '',
        resume: data.resume || ''
      };
      // Pre-fill settings form
      if ($('apiKeyInput')) $('apiKeyInput').value = apiKey;
      if ($('nameInput'))   $('nameInput').value = profile.name;
      if ($('emailInput'))  $('emailInput').value = profile.email;
      if ($('resumeInput')) $('resumeInput').value = profile.resume;
      resolve();
    });
  });
}

function hasResumeBuilderData(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.summary) return true;
  if (Object.values(data.personal || {}).some(Boolean)) return true;
  if ((data.experience || []).length) return true;
  if ((data.education || []).length) return true;
  if ((data.projects || []).length) return true;
  if ((data.certifications || []).length) return true;
  if ((data.achievements || []).length) return true;
  if ((data.languages || []).length) return true;
  if ((data.publications || []).length) return true;
  return Object.values(data.skills || {}).some(list => Array.isArray(list) && list.length);
}

function sanitizeFileNamePart(value, fallback = 'Resume') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function buildTailoredResumeFileName(resumeData) {
  const fullName = [
    resumeData?.personal?.firstName || profile.name || '',
    resumeData?.personal?.lastName || ''
  ].join(' ').trim() || profile.name || 'Candidate';

  const company = sanitizeFileNamePart(jobData?.company, '');
  const role = sanitizeFileNamePart(jobData?.title, 'Tailored Resume');
  const parts = [sanitizeFileNamePart(fullName, 'Candidate'), role];
  if (company) parts.push(company);
  return `${parts.join(' - ')}.pdf`;
}

async function getOrCreateResumeBuilderData() {
  const data = await storageGet(['resumeBuilder']);
  if (hasResumeBuilderData(data.resumeBuilder)) {
    return data.resumeBuilder;
  }

  const parsed = await parseResumeStructured(profile.resume, apiKey);
  await storageSet({ resumeBuilder: parsed });
  renderBuilderFields(parsed);
  $('builderFields')?.classList.remove('hidden');
  return parsed;
}

function renderTailoredResumeReady(previewState) {
  const companyText = previewState?.job?.company ? ` at ${previewState.job.company}` : '';
  const titleText = previewState?.job?.title || 'this role';
  $('resumeContent').textContent = `Tailored resume ready for ${titleText}${companyText}. Open the preview to review the final layout and download the PDF.`;
  $('resumeResult').classList.remove('hidden');
  $('openResumePreviewBtn')?.classList.remove('hidden');
}

async function openTailoredResumePreview() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('preview/resume-preview.html')
  });
}

async function restoreTailoredResumeState() {
  const data = await storageGet([TAILORED_PREVIEW_KEY]);
  if (data[TAILORED_PREVIEW_KEY]?.resumeData) {
    renderTailoredResumeReady(data[TAILORED_PREVIEW_KEY]);
  }
}

// ── TAB SWITCHING ──
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
      });
      tab.classList.add('active');
      const pane = $(`tab-${targetId}`);
      if (pane) {
        pane.classList.remove('hidden');
        pane.classList.add('active');
      }
    });
  });
}

// ── SETTINGS PANEL ──
function setupSettings() {
  $('settingsBtn').addEventListener('click', () => {
    $('settingsPanel').classList.toggle('open');
  });

  $('closeSettings').addEventListener('click', () => {
    $('settingsPanel').classList.remove('open');
  });

  $('toggleKey').addEventListener('click', () => {
    const input = $('apiKeyInput');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('saveSettings').addEventListener('click', () => {
    const oldResume = profile.resume;
    apiKey = $('apiKeyInput').value.trim();
    profile.name = $('nameInput').value.trim();
    profile.email = $('emailInput').value.trim();
    profile.resume = $('resumeInput').value.trim();

    chrome.storage.local.set({
      apiKey,
      name: profile.name,
      email: profile.email,
      resume: profile.resume
    }, () => {
      const toast = $('saveToast');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
      // Only re-parse when the resume text itself changed, not when just the API key changed
      if (apiKey && profile.resume && profile.resume !== oldResume) {
        triggerAutoParseResume();
      }
    });
  });
}

// ── JOB DETECTION ──
async function detectJob() {
  setBanner('pulse', 'Analyzing page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setBanner('error', 'Cannot access this tab');
      showJobError();
      return;
    }

    // Inject content script if needed (for pages not matching manifest patterns)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js']
      });
    } catch (_) {
      // Content script likely already injected, continue
    }

    const response = await requestJobExtractionWithRetry(tab.id);

    if (!response?.success || !response?.data) {
      setBanner('error', 'No job posting detected');
      showJobError();
      return;
    }

    jobData = response.data;
    renderJobDetails(jobData);
    setBanner('active', `${jobData.platform} job detected`);

  } catch (err) {
    setBanner('error', 'Access error');
    showJobError();
  }
}

function sendExtractJobMessage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractJob' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasMeaningfulJobData(response) {
  const data = response?.data;
  return Boolean(
    response?.success &&
    data &&
    data.title &&
    data.description &&
    data.description.trim().length > 120
  );
}

async function requestJobExtractionWithRetry(tabId, attempts = 4) {
  let lastResponse = null;

  for (let i = 0; i < attempts; i++) {
    const response = await sendExtractJobMessage(tabId);
    lastResponse = response;

    if (hasMeaningfulJobData(response)) {
      return response;
    }

    if (i < attempts - 1) {
      await wait(600);
    }
  }

  return lastResponse;
}

function setBanner(state, text) {
  const dot = $('detectDot');
  const textEl = $('detectText');
  dot.className = 'detect-dot';
  if (state) dot.classList.add(state);
  textEl.textContent = text;
}

function showJobError() {
  $('jobLoading').classList.add('hidden');
  $('jobDetails').classList.add('hidden');
  $('jobError').classList.remove('hidden');
}

function renderJobDetails(data) {
  $('jobLoading').classList.add('hidden');
  $('jobError').classList.add('hidden');

  $('jobTitle').textContent    = data.title || 'Untitled Role';
  $('jobCompany').textContent  = data.company || 'Unknown Company';
  $('jobLocation').textContent = data.location ? `📍 ${data.location}` : '📍 Location N/A';
  $('jobPlatform').textContent = data.platform || 'Unknown';
  $('jobDesc').value           = data.description || '';

  $('jobDetails').classList.remove('hidden');
}

function setupJobDescEditing() {
  $('jobDesc').addEventListener('input', () => {
    if (!jobData) jobData = { title: '', company: '', location: '', platform: 'Manual' };
    jobData.description = $('jobDesc').value;
  });

  $('useManualDescBtn').addEventListener('click', () => {
    const desc = $('manualJobDesc').value.trim();
    if (!desc) { showToast('⚠️ Please paste a job description first'); return; }
    jobData = { title: 'Manual Entry', company: '', location: '', platform: 'Manual', description: desc };
    renderJobDetails(jobData);
    setBanner('active', 'Manual job description loaded');
    showToast('✅ Job description loaded');
  });
}

// ── ACTION BUTTONS ──
function setupActions() {
  $('extractJobBtn').addEventListener('click', () => {
    $('jobDetails').classList.add('hidden');
    $('jobError').classList.add('hidden');
    $('jobLoading').classList.remove('hidden');
    detectJob();
  });
  $('tailorResumeBtn').addEventListener('click', () => handleTailorResume());
  $('genCoverBtn').addEventListener('click', () => handleCoverLetter());
  $('checkATSBtn').addEventListener('click', () => handleATSScore());
  $('openResumePreviewBtn')?.addEventListener('click', () => openTailoredResumePreview());
  $('openCoverPreviewBtn')?.addEventListener('click', () => openCoverLetterPreview());

  const legacyResumeCopyBtn = document.querySelector('#resumeResult .copy-btn[data-target="resumeContent"]');
  if (legacyResumeCopyBtn) legacyResumeCopyBtn.classList.add('hidden');

  const resumeResultLabel = document.querySelector('#resumeResult .result-label');
  if (resumeResultLabel) resumeResultLabel.textContent = 'Tailored Resume Ready';

  // Copy buttons
  document.querySelectorAll('.copy-btn[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const text = $(targetId)?.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });
}

// ── GUARD CHECK ──
function guardCheck(featureName) {
  if (!apiKey) {
    showToast('⚠️ Add your Gemini API key in Settings first');
    $('settingsPanel').classList.add('open');
    return false;
  }
  if (!profile.resume) {
    showToast('⚠️ Add your base resume in Settings first');
    $('settingsPanel').classList.add('open');
    return false;
  }
  if (!jobData || !jobData.description) {
    showToast('⚠️ No job detected. Open a job listing page first');
    return false;
  }
  return true;
}

// ── TAILOR RESUME ──
async function handleTailorResume() {
  if (!guardCheck('Resume Tailor')) return;

  const btn = $('tailorResumeBtn');
  btn.disabled = true;
  $('resumeLoading').classList.remove('hidden');
  $('resumeResult').classList.add('hidden');
  $('openResumePreviewBtn')?.classList.add('hidden');

  try {
    const resumeBuilderData = await getOrCreateResumeBuilderData();
    const tailoredResume = await tailorResumeStructured({
      jobTitle: jobData.title,
      company: jobData.company,
      jobDescription: jobData.description,
      resumeData: resumeBuilderData,
      candidateName: profile.name
    }, apiKey);

    const previewState = {
      generatedAt: Date.now(),
      fileName: buildTailoredResumeFileName(tailoredResume),
      job: {
        title: jobData.title || '',
        company: jobData.company || '',
        location: jobData.location || '',
        platform: jobData.platform || ''
      },
      resumeData: tailoredResume
    };

    await storageSet({
      [TAILORED_PREVIEW_KEY]: previewState,
      tailoredResume: tailoredResume
    });

    renderTailoredResumeReady(previewState);
    await openTailoredResumePreview();
    showToast('✅ Resume tailored successfully!');
  } catch (err) {
    showToast(`❌ ${err.message}`);
  } finally {
    btn.disabled = false;
    $('resumeLoading').classList.add('hidden');
  }
}

// ── COVER LETTER ──
async function handleCoverLetter() {
  if (!guardCheck('Cover Letter')) return;

  const btn = $('genCoverBtn');
  btn.disabled = true;
  $('coverLoading').classList.remove('hidden');
  $('coverResult').classList.add('hidden');

  try {
    const result = await generateCoverLetter({
      jobTitle: jobData.title,
      company: jobData.company,
      jobDescription: jobData.description,
      baseResume: profile.resume,
      candidateName: profile.name,
      email: profile.email
    }, apiKey);

    const coverState = {
      coverLetterText: result,
      candidateName: profile.name,
      email: profile.email,
      job: {
        title: jobData.title || '',
        company: jobData.company || ''
      },
      generatedAt: Date.now()
    };

    await storageSet({ [COVER_LETTER_KEY]: coverState });
    renderCoverLetterReady(coverState);
    await openCoverLetterPreview();
    showToast('✅ Cover letter generated!');
  } catch (err) {
    showToast(`❌ ${err.message}`);
  } finally {
    btn.disabled = false;
    $('coverLoading').classList.add('hidden');
  }
}

function renderCoverLetterReady(state) {
  const companyText = state?.job?.company ? ` at ${state.job.company}` : '';
  const titleText = state?.job?.title || 'this role';
  $('coverContent').textContent = `Cover letter ready for ${titleText}${companyText}. Open the preview to review and download the PDF.`;
  $('coverResult').classList.remove('hidden');
  $('openCoverPreviewBtn')?.classList.remove('hidden');
}

async function openCoverLetterPreview() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('preview/cover-letter-preview.html')
  });
}

async function restoreCoverLetterState() {
  const data = await storageGet([COVER_LETTER_KEY]);
  if (data[COVER_LETTER_KEY]?.coverLetterText) {
    renderCoverLetterReady(data[COVER_LETTER_KEY]);
  }
}

// ── ATS SCORE ──
async function handleATSScore() {
  if (!guardCheck('ATS Score')) return;

  const btn = $('checkATSBtn');
  btn.disabled = true;
  $('atsLoading').classList.remove('hidden');
  $('atsResult').classList.add('hidden');

  try {
    const result = await checkATSScore({
      jobDescription: jobData.description,
      resume: profile.resume
    }, apiKey);

    renderATSResult(result);
    $('atsResult').classList.remove('hidden');
    showToast(`✅ ATS Score: ${result.score}% — ${result.grade}`);
  } catch (err) {
    showToast(`❌ ${err.message}`);
  } finally {
    btn.disabled = false;
    $('atsLoading').classList.add('hidden');
  }
}

function renderATSResult(result) {
  const score = Math.min(100, Math.max(0, result.score || 0));
  const circumference = 2 * Math.PI * 50; // r=50 → ~314.16

  // Score circle animation
  const ring = $('scoreRing');
  const offset = circumference - (score / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  // Color based on score
  ring.className = 'ring-fill';
  if (score >= 75) ring.classList.add('good');
  else if (score >= 50) ring.classList.add('warn');
  else ring.classList.add('bad');

  $('scoreValue').textContent = `${score}%`;
  $('scoreLabel').textContent = result.grade || 'ATS Match';

  // Matched keywords
  const matchedKw = $('matchedKw');
  matchedKw.innerHTML = '';
  (result.matched_keywords || []).slice(0, 12).forEach(kw => {
    const chip = document.createElement('span');
    chip.className = 'kw-chip match';
    chip.textContent = kw;
    matchedKw.appendChild(chip);
  });
  if (!result.matched_keywords?.length) {
    matchedKw.innerHTML = '<span style="color:var(--text3);font-size:11px">None found</span>';
  }

  // Missing keywords
  const missingKw = $('missingKw');
  missingKw.innerHTML = '';
  (result.missing_keywords || []).slice(0, 12).forEach(kw => {
    const chip = document.createElement('span');
    chip.className = 'kw-chip miss';
    chip.textContent = kw;
    missingKw.appendChild(chip);
  });
  if (!result.missing_keywords?.length) {
    missingKw.innerHTML = '<span style="color:var(--text3);font-size:11px">None identified</span>';
  }

  // Suggestions
  $('atsSuggestions').textContent = result.suggestions || 'No suggestions available.';
}

// ── TOAST ──
function showToast(msg, duration = 3000) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── RESUME BUILDER ──

const SKILL_CATEGORIES = [
  { id: 'programmingLanguages', label: 'Programming Languages' },
  { id: 'csConcepts',           label: 'Core CS Concepts' },
  { id: 'webDevelopment',       label: 'Web Development' },
  { id: 'databases',            label: 'Databases' },
  { id: 'cloudPlatforms',       label: 'Cloud & Platforms' },
  { id: 'mlAI',                 label: 'Machine Learning & AI' },
  { id: 'mobileDevelopment',    label: 'Mobile Development' }
];

function setupResumeBuilder() {
  $('parseResumeBtn').addEventListener('click', handleParseResume);
  $('saveBuilderBtn').addEventListener('click', saveBuilderData);
  $('addExpBtn').addEventListener('click', () => addExpEntry({}));
  $('addEduBtn').addEventListener('click', () => addEduEntry({}));
  $('addProjectBtn').addEventListener('click', () => addProjectEntry({}));
  $('addCertBtn').addEventListener('click', () => addSimpleEntry('b-cert-list', 'Certification', 'cert'));
  $('addAchievementBtn').addEventListener('click', () => addSimpleEntry('b-achievement-list', 'Achievement', 'achievement'));
  $('addLanguageBtn').addEventListener('click', () => addLanguageEntry({}));
  $('addPublicationBtn').addEventListener('click', () => addSimpleEntry('b-publication-list', 'Publication', 'publication'));
  renderSkillCategories({});
  loadBuilderData();
}

async function handleParseResume() {
  if (!apiKey) {
    showToast('⚠️ Add your Gemini API key in Settings first');
    $('settingsPanel').classList.add('open');
    return;
  }
  if (!profile.resume) {
    showToast('⚠️ Add your base resume in Settings first');
    $('settingsPanel').classList.add('open');
    return;
  }
  const btn = $('parseResumeBtn');
  btn.disabled = true;
  $('builderLoading').classList.remove('hidden');
  $('builderFields').classList.add('hidden');
  try {
    const parsed = await parseResumeStructured(profile.resume, apiKey);
    renderBuilderFields(parsed);
    chrome.storage.local.set({ resumeBuilder: parsed });
    $('builderFields').classList.remove('hidden');
    showToast('✅ Resume parsed into fields!');
  } catch (err) {
    console.error('[Builder parse error]', err);
    showToast(`❌ ${err.message}`);
  } finally {
    btn.disabled = false;
    $('builderLoading').classList.add('hidden');
  }
}

async function triggerAutoParseResume() {
  try {
    $('builderLoading')?.classList.remove('hidden');
    $('builderFields')?.classList.add('hidden');
    const parsed = await parseResumeStructured(profile.resume, apiKey);
    renderBuilderFields(parsed);
    chrome.storage.local.set({ resumeBuilder: parsed });
    $('builderFields')?.classList.remove('hidden');
    showToast('🏗️ Resume Builder fields updated!');
  } catch (_) {
    // silent — user can parse manually from Builder tab
  } finally {
    $('builderLoading')?.classList.add('hidden');
  }
}

function renderBuilderFields(data) {
  const p = data.personal || {};
  $('b-firstName').value = p.firstName || '';
  $('b-lastName').value  = p.lastName  || '';
  $('b-email').value     = p.email     || '';
  $('b-phone').value     = p.phone     || '';
  $('b-location').value  = p.location  || '';
  $('b-linkedin').value  = p.linkedin  || '';
  $('b-github').value    = p.github    || '';
  $('b-summary').value   = data.summary || '';

  $('b-experience-list').innerHTML = '';
  (data.experience || []).forEach(exp => addExpEntry(exp));
  if (!data.experience?.length) addExpEntry({});

  $('b-education-list').innerHTML = '';
  (data.education || []).forEach(edu => addEduEntry(edu));
  if (!data.education?.length) addEduEntry({});

  renderSkillCategories(data.skills || {});

  $('b-projects-list').innerHTML = '';
  (data.projects || []).forEach(proj => addProjectEntry(proj));

  $('b-cert-list').innerHTML = '';
  (data.certifications || []).forEach(c => addSimpleEntry('b-cert-list', 'Certification', 'cert', c));

  $('b-achievement-list').innerHTML = '';
  (data.achievements || []).forEach(a => addSimpleEntry('b-achievement-list', 'Achievement', 'achievement', a));

  $('b-language-list').innerHTML = '';
  (data.languages || []).forEach(l => addLanguageEntry(l));

  $('b-publication-list').innerHTML = '';
  (data.publications || []).forEach(pub => addSimpleEntry('b-publication-list', 'Publication', 'publication', pub));
}

// Normalize whatever Gemini returns for bullets into a clean string array
function toBullets(val) {
  if (Array.isArray(val)) return val.map(String).filter(v => v.trim());
  if (typeof val === 'string' && val.trim()) return val.split('\n').map(s => s.replace(/^[•\-–*]\s*/,'').trim()).filter(v => v);
  return [];
}

// ── EXPERIENCE ──
function addExpEntry(data) {
  const list = $('b-experience-list');
  const idx  = list.children.length + 1;
  const div  = document.createElement('div');
  div.className = 'builder-entry';
  const isCurrent = data.current || false;
  div.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Experience #${idx}</span>
      <button class="remove-entry-btn" type="button">✕</button>
    </div>
    <div class="form-group"><label class="form-label">Job Title</label>
      <input type="text" class="form-input exp-title" value="${esc(data.title)}" /></div>
    <div class="form-group"><label class="form-label">Company Name</label>
      <input type="text" class="form-input exp-company" value="${esc(data.company)}" /></div>
    <div class="form-group"><label class="form-label">Location</label>
      <input type="text" class="form-input exp-location" value="${esc(data.location)}" /></div>
    <div class="form-row-2">
      <div class="form-group"><label class="form-label">Start Date</label>
        <input type="text" class="form-input exp-start" placeholder="Jan 2022" value="${esc(data.startDate)}" /></div>
      <div class="form-group"><label class="form-label">End Date</label>
        <input type="text" class="form-input exp-end" placeholder="Present"
          value="${isCurrent ? 'Present' : esc(data.endDate)}"
          ${isCurrent ? 'disabled style="opacity:0.4"' : ''} /></div>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" class="exp-current" ${isCurrent ? 'checked' : ''} />
      <span>Currently Working Here</span>
    </label>
    <div class="form-group">
      <label class="form-label">Bullet Points</label>
      <div class="bullet-list">${(() => { const b = toBullets(data.bullets); return (b.length ? b : ['']).map(bulletRowHtml).join(''); })()}</div>
      <button class="add-bullet-btn" type="button">+ Add Bullet</button>
    </div>`;
  div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
  wireCurrentCheckbox(div, '.exp-current', '.exp-end');
  wireBulletAdder(div);
  list.appendChild(div);
}

// ── EDUCATION ──
function addEduEntry(data) {
  const list = $('b-education-list');
  const idx  = list.children.length + 1;
  const div  = document.createElement('div');
  div.className = 'builder-entry';
  const isCurrent = data.current || false;
  div.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Education #${idx}</span>
      <button class="remove-entry-btn" type="button">✕</button>
    </div>
    <div class="form-group"><label class="form-label">College / School Name</label>
      <input type="text" class="form-input edu-school" value="${esc(data.school)}" /></div>
    <div class="form-group"><label class="form-label">Degree &amp; Branch</label>
      <input type="text" class="form-input edu-degree" placeholder="B.Tech Computer Science" value="${esc(data.degree)}" /></div>
    <div class="form-group"><label class="form-label">Location</label>
      <input type="text" class="form-input edu-location" value="${esc(data.location)}" /></div>
    <div class="form-row-2">
      <div class="form-group"><label class="form-label">Start Date</label>
        <input type="text" class="form-input edu-start" placeholder="Aug 2020" value="${esc(data.startDate)}" /></div>
      <div class="form-group"><label class="form-label">End Date</label>
        <input type="text" class="form-input edu-end" placeholder="May 2024"
          value="${isCurrent ? 'Present' : esc(data.endDate)}"
          ${isCurrent ? 'disabled style="opacity:0.4"' : ''} /></div>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" class="edu-current" ${isCurrent ? 'checked' : ''} />
      <span>Currently Studying Here</span>
    </label>
    <div class="form-group"><label class="form-label">CGPA / Percentage</label>
      <input type="text" class="form-input edu-cgpa" placeholder="8.5 CGPA / 85%" value="${esc(data.cgpa)}" /></div>
    <div class="form-group">
      <label class="form-label">Bullet Points</label>
      <div class="bullet-list">${(() => { const b = toBullets(data.bullets); return b.map(bulletRowHtml).join(''); })()}</div>
      <button class="add-bullet-btn" type="button">+ Add Bullet</button>
    </div>`;
  div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
  wireCurrentCheckbox(div, '.edu-current', '.edu-end');
  wireBulletAdder(div);
  list.appendChild(div);
}

// ── PROJECTS ──
function addProjectEntry(data) {
  const list = $('b-projects-list');
  const idx  = list.children.length + 1;
  const div  = document.createElement('div');
  div.className = 'builder-entry';
  const isCurrent = data.current || false;
  div.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">Project #${idx}</span>
      <button class="remove-entry-btn" type="button">✕</button>
    </div>
    <div class="form-group"><label class="form-label">Project Name</label>
      <input type="text" class="form-input proj-name" value="${esc(data.name)}" /></div>
    <div class="form-group"><label class="form-label">Organization</label>
      <input type="text" class="form-input proj-org" value="${esc(data.organization)}" /></div>
    <div class="form-group"><label class="form-label">Project Link (GitHub)</label>
      <input type="text" class="form-input proj-link" placeholder="https://github.com/..." value="${esc(data.link)}" /></div>
    <div class="form-group"><label class="form-label">Location</label>
      <input type="text" class="form-input proj-location" value="${esc(data.location)}" /></div>
    <div class="form-row-2">
      <div class="form-group"><label class="form-label">Start Date</label>
        <input type="text" class="form-input proj-start" placeholder="Jan 2023" value="${esc(data.startDate)}" /></div>
      <div class="form-group"><label class="form-label">End Date</label>
        <input type="text" class="form-input proj-end" placeholder="Present"
          value="${isCurrent ? 'Present' : esc(data.endDate)}"
          ${isCurrent ? 'disabled style="opacity:0.4"' : ''} /></div>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" class="proj-current" ${isCurrent ? 'checked' : ''} />
      <span>Currently Working on This</span>
    </label>
    <div class="form-group">
      <label class="form-label">Bullet Points</label>
      <div class="bullet-list">${(() => { const b = toBullets(data.bullets); return (b.length ? b : ['']).map(bulletRowHtml).join(''); })()}</div>
      <button class="add-bullet-btn" type="button">+ Add Bullet</button>
    </div>`;
  div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
  wireCurrentCheckbox(div, '.proj-current', '.proj-end');
  wireBulletAdder(div);
  list.appendChild(div);
}

// ── SKILLS ──
function renderSkillCategories(skillsData) {
  const container = $('b-skills-container');
  container.innerHTML = '';
  SKILL_CATEGORIES.forEach(cat => {
    const catDiv = document.createElement('div');
    catDiv.className = 'skill-category';
    catDiv.innerHTML = `
      <div class="skill-cat-label">${cat.label}</div>
      <div class="skill-chips-row" id="skillcat-${cat.id}"></div>
      <div class="skill-add-row">
        <input type="text" class="skill-add-input" placeholder="Type skill + Enter..." />
        <button class="skill-add-btn" type="button">+</button>
      </div>`;
    container.appendChild(catDiv);
    const chipsRow = catDiv.querySelector(`#skillcat-${cat.id}`);
    (skillsData[cat.id] || []).forEach(skill => addSkillChip(chipsRow, skill));
    const addInput = catDiv.querySelector('.skill-add-input');
    catDiv.querySelector('.skill-add-btn').addEventListener('click', () => {
      const val = addInput.value.trim();
      if (val) { addSkillChip(chipsRow, val); addInput.value = ''; }
    });
    addInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val) { addSkillChip(chipsRow, val); e.target.value = ''; }
      }
    });
  });
}

function addSkillChip(container, text) {
  const chip = document.createElement('div');
  chip.className = 'skill-chip';
  chip.innerHTML = `<span class="skill-chip-text">${esc(text)}</span><button class="skill-chip-remove" type="button">×</button>`;
  chip.querySelector('.skill-chip-remove').addEventListener('click', () => chip.remove());
  container.appendChild(chip);
}

// ── SIMPLE LIST (Certifications, Achievements, Publications) ──
function addSimpleEntry(listId, label, cls, value = '') {
  const list = $(listId);
  const div  = document.createElement('div');
  div.className = 'simple-entry';
  div.innerHTML = `
    <input type="text" class="form-input ${cls}-input" value="${esc(value)}" placeholder="${label}..." />
    <button class="remove-entry-btn" type="button">✕</button>`;
  div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
  list.appendChild(div);
}

// ── LANGUAGES ──
function addLanguageEntry(data) {
  const list = $('b-language-list');
  const div  = document.createElement('div');
  div.className = 'language-entry';
  const prof = data.proficiency || 'Professional';
  div.innerHTML = `
    <input type="text" class="form-input lang-name" placeholder="Language..." value="${esc(data.name)}" />
    <select class="lang-proficiency">
      <option value="Native"       ${prof === 'Native'       ? 'selected' : ''}>Native</option>
      <option value="Professional" ${prof === 'Professional' ? 'selected' : ''}>Professional</option>
      <option value="Basic"        ${prof === 'Basic'        ? 'selected' : ''}>Basic</option>
    </select>
    <button class="remove-entry-btn" type="button">✕</button>`;
  div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
  list.appendChild(div);
}

// ── BULLET HELPERS ──
function bulletRowHtml(text) {
  return `<div class="bullet-row">
    <input type="text" class="form-input bullet-input" value="${esc(text)}" placeholder="Achieved..." />
    <button class="remove-bullet-btn" type="button">✕</button>
  </div>`;
}

function wireBulletAdder(entry) {
  entry.querySelectorAll('.bullet-row').forEach(row =>
    row.querySelector('.remove-bullet-btn').addEventListener('click', () => row.remove())
  );
  entry.querySelector('.add-bullet-btn').addEventListener('click', () => {
    const list = entry.querySelector('.bullet-list');
    const row  = document.createElement('div');
    row.innerHTML = bulletRowHtml('');
    const newRow = row.firstElementChild;
    newRow.querySelector('.remove-bullet-btn').addEventListener('click', () => newRow.remove());
    list.appendChild(newRow);
  });
}

function wireCurrentCheckbox(entry, cbSelector, endSelector) {
  const cb  = entry.querySelector(cbSelector);
  const end = entry.querySelector(endSelector);
  cb.addEventListener('change', () => {
    end.disabled = cb.checked;
    end.style.opacity = cb.checked ? '0.4' : '1';
    if (cb.checked) end.value = 'Present';
  });
}

// ── COLLECT ──
function collectBullets(entry) {
  return Array.from(entry.querySelectorAll('.bullet-input'))
    .map(i => i.value.trim()).filter(v => v);
}

function collectBuilderData() {
  const experience = [];
  $('b-experience-list').querySelectorAll('.builder-entry').forEach(e => {
    experience.push({
      title:     e.querySelector('.exp-title')?.value    || '',
      company:   e.querySelector('.exp-company')?.value  || '',
      location:  e.querySelector('.exp-location')?.value || '',
      startDate: e.querySelector('.exp-start')?.value    || '',
      endDate:   e.querySelector('.exp-end')?.value      || '',
      current:   e.querySelector('.exp-current')?.checked || false,
      bullets:   collectBullets(e)
    });
  });

  const education = [];
  $('b-education-list').querySelectorAll('.builder-entry').forEach(e => {
    education.push({
      school:    e.querySelector('.edu-school')?.value    || '',
      degree:    e.querySelector('.edu-degree')?.value    || '',
      location:  e.querySelector('.edu-location')?.value  || '',
      startDate: e.querySelector('.edu-start')?.value     || '',
      endDate:   e.querySelector('.edu-end')?.value       || '',
      current:   e.querySelector('.edu-current')?.checked || false,
      cgpa:      e.querySelector('.edu-cgpa')?.value      || '',
      bullets:   collectBullets(e)
    });
  });

  const skills = {};
  SKILL_CATEGORIES.forEach(cat => {
    skills[cat.id] = Array.from(
      $(`skillcat-${cat.id}`)?.querySelectorAll('.skill-chip-text') || []
    ).map(el => el.textContent.trim()).filter(v => v);
  });

  const projects = [];
  $('b-projects-list').querySelectorAll('.builder-entry').forEach(e => {
    projects.push({
      name:         e.querySelector('.proj-name')?.value     || '',
      organization: e.querySelector('.proj-org')?.value      || '',
      link:         e.querySelector('.proj-link')?.value     || '',
      location:     e.querySelector('.proj-location')?.value || '',
      startDate:    e.querySelector('.proj-start')?.value    || '',
      endDate:      e.querySelector('.proj-end')?.value      || '',
      current:      e.querySelector('.proj-current')?.checked || false,
      bullets:      collectBullets(e)
    });
  });

  const certifications = Array.from($('b-cert-list')?.querySelectorAll('.cert-input') || [])
    .map(i => i.value.trim()).filter(v => v);
  const achievements = Array.from($('b-achievement-list')?.querySelectorAll('.achievement-input') || [])
    .map(i => i.value.trim()).filter(v => v);
  const publications = Array.from($('b-publication-list')?.querySelectorAll('.publication-input') || [])
    .map(i => i.value.trim()).filter(v => v);

  const languages = [];
  $('b-language-list').querySelectorAll('.language-entry').forEach(e => {
    const name = e.querySelector('.lang-name')?.value?.trim();
    if (name) languages.push({ name, proficiency: e.querySelector('.lang-proficiency')?.value || 'Professional' });
  });

  return {
    personal: {
      firstName: $('b-firstName')?.value || '',
      lastName:  $('b-lastName')?.value  || '',
      email:     $('b-email')?.value     || '',
      phone:     $('b-phone')?.value     || '',
      location:  $('b-location')?.value  || '',
      linkedin:  $('b-linkedin')?.value  || '',
      github:    $('b-github')?.value    || ''
    },
    summary: $('b-summary')?.value || '',
    experience, education, skills, projects,
    certifications, achievements, languages, publications
  };
}

function saveBuilderData() {
  const data = collectBuilderData();
  chrome.storage.local.set({ resumeBuilder: data }, () => {
    showToast('✅ Resume fields saved!');
  });
}

function loadBuilderData() {
  chrome.storage.local.get(['resumeBuilder'], (data) => {
    if (data.resumeBuilder) {
      renderBuilderFields(data.resumeBuilder);
      $('builderFields').classList.remove('hidden');
    }
  });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
