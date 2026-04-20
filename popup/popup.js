// ── LETMEAPPLY POPUP SCRIPT ──

// ── STATE ──
let jobData = null;
let profile = {};
let apiKey = '';

// ── DOM REFS ──
const $ = id => document.getElementById(id);

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  setupTabs();
  setupSettings();
  setupActions();
  detectJob();
});

// ── LOAD PROFILE ──
async function loadProfile() {
  return new Promise(resolve => {
    chrome.storage.local.get(['apiKey', 'name', 'email', 'skills', 'resume'], (data) => {
      apiKey = data.apiKey || '';
      profile = {
        name: data.name || '',
        email: data.email || '',
        skills: data.skills || '',
        resume: data.resume || ''
      };
      // Pre-fill settings form
      if ($('apiKeyInput')) $('apiKeyInput').value = apiKey;
      if ($('nameInput'))   $('nameInput').value = profile.name;
      if ($('emailInput'))  $('emailInput').value = profile.email;
      if ($('skillsInput')) $('skillsInput').value = profile.skills;
      if ($('resumeInput')) $('resumeInput').value = profile.resume;
      resolve();
    });
  });
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
    apiKey = $('apiKeyInput').value.trim();
    profile.name = $('nameInput').value.trim();
    profile.email = $('emailInput').value.trim();
    profile.skills = $('skillsInput').value.trim();
    profile.resume = $('resumeInput').value.trim();

    chrome.storage.local.set({
      apiKey,
      name: profile.name,
      email: profile.email,
      skills: profile.skills,
      resume: profile.resume
    }, () => {
      const toast = $('saveToast');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
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

    chrome.tabs.sendMessage(tab.id, { action: 'extractJob' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setBanner('error', 'Could not read page');
        showJobError();
        return;
      }

      if (!response.success || !response.data) {
        setBanner('error', 'No job posting detected');
        showJobError();
        return;
      }

      jobData = response.data;
      renderJobDetails(jobData);
      setBanner('active', `${jobData.platform} job detected`);
    });

  } catch (err) {
    setBanner('error', 'Access error');
    showJobError();
  }
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
  $('jobDesc').textContent     = data.description || 'No description extracted.';

  $('jobDetails').classList.remove('hidden');
}

// ── ACTION BUTTONS ──
function setupActions() {
  $('tailorResumeBtn').addEventListener('click', () => handleTailorResume());
  $('genCoverBtn').addEventListener('click', () => handleCoverLetter());
  $('checkATSBtn').addEventListener('click', () => handleATSScore());

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
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

  try {
    const result = await tailorResume({
      jobTitle: jobData.title,
      company: jobData.company,
      jobDescription: jobData.description,
      baseResume: profile.resume,
      candidateName: profile.name
    }, apiKey);

    $('resumeContent').textContent = result;
    $('resumeResult').classList.remove('hidden');
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

    $('coverContent').textContent = result;
    $('coverResult').classList.remove('hidden');
    showToast('✅ Cover letter generated!');
  } catch (err) {
    showToast(`❌ ${err.message}`);
  } finally {
    btn.disabled = false;
    $('coverLoading').classList.add('hidden');
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

// ── LOAD GEMINI UTILS (injected via script tag in popup context) ──
// Since popup.html loads popup.js directly, we import gemini utils via script
// The functions tailorResume, generateCoverLetter, checkATSScore are defined in gemini.js
// which is loaded before popup.js via the popup.html
