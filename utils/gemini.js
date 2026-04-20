// ── GEMINI API UTILITY ──
// Supports gemini-2.0-flash (default) with easy model switching

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Core Gemini API call
 */
async function callGemini(prompt, apiKey, config = {}) {
  const response = await fetch(GEMINI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API Error: ${msg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response.");
  return text.trim();
}

/**
 * Tailor resume for a specific job
 */
async function tailorResume(
  { jobTitle, company, jobDescription, baseResume, candidateName },
  apiKey,
) {
  const prompt = `You are an expert resume writer and ATS optimization specialist.

CANDIDATE NAME: ${candidateName || "Candidate"}

JOB DETAILS:
Title: ${jobTitle || "Not specified"}
Company: ${company || "Not specified"}
Description:
${jobDescription}

CURRENT RESUME:
${baseResume}

TASK: Rewrite and optimize this resume to perfectly match the job description above.

Guidelines:
- Keep the candidate's actual experience and truthful information — only reframe/reword
- Match important keywords from the job description naturally throughout
- Rewrite the professional summary to target this specific role
- Reorganize bullets to lead with most relevant achievements
- Ensure ATS compatibility (no tables, columns, or graphics)
- Keep it to 1-2 pages worth of content
- Format clearly: Summary | Experience | Skills | Education | Certifications (if any)
- Use strong action verbs and quantify achievements where possible

Return ONLY the tailored resume text — no commentary, no markdown fences.`;

  return await callGemini(prompt, apiKey);
}

/**
 * Generate personalized cover letter
 */
async function generateCoverLetter(
  { jobTitle, company, jobDescription, baseResume, candidateName, email },
  apiKey,
) {
  const prompt = `You are an expert career coach and professional writer.

CANDIDATE: ${candidateName || "Candidate"} | ${email || ""}

JOB DETAILS:
Title: ${jobTitle || "this role"}
Company: ${company || "this company"}
Description:
${jobDescription}

CANDIDATE'S BACKGROUND (from resume):
${baseResume}

TASK: Write a compelling, personalized cover letter for this specific job.

Guidelines:
- Strong opening hook — don't start with "I am writing to apply..."
- Mention the company by name naturally (show you did your research)
- Highlight 2-3 specific, quantifiable achievements directly relevant to this role
- Show enthusiasm for this specific role/company, not just "any job"
- Address key requirements from the job description
- Keep it under 320 words — concise and punchy
- Close with a confident, specific call to action
- Professional but warm tone — not robotic

Format:
[Date]
Hiring Manager
${company || "[Company Name]"}

Dear Hiring Manager,

[Body paragraphs]

Best regards,
${candidateName || "[Your Name]"}
${email || "[Email]"}

Return ONLY the cover letter — no commentary, no markdown fences.`;

  return await callGemini(prompt, apiKey);
}

/**
 * Parse raw resume text into structured JSON fields
 */
async function parseResumeStructured(resumeText, apiKey) {
  const prompt = `You are an expert resume parser. Extract ALL information from the resume text below into this EXACT JSON structure. Return ONLY valid JSON — no markdown, no code fences, no explanation.

RESUME TEXT:
${resumeText}

JSON STRUCTURE TO FILL:
{
  "personal": {
    "firstName": "",
    "lastName": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": ""
  },
  "summary": "",
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "bullets": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "cgpa": "",
      "bullets": []
    }
  ],
  "skills": {
    "programmingLanguages": [],
    "csConcepts": [],
    "webDevelopment": [],
    "databases": [],
    "cloudPlatforms": [],
    "mlAI": [],
    "mobileDevelopment": []
  },
  "projects": [
    {
      "name": "",
      "organization": "",
      "link": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "bullets": ["bullet point 1"]
    }
  ],
  "certifications": ["certification name here"],
  "achievements": ["achievement text here"],
  "languages": [
    { "name": "", "proficiency": "Professional" }
  ],
  "publications": ["publication text here"]
}

STRICT RULES:
1. Extract ALL jobs, ALL education entries, ALL projects — never skip entries
2. Bullets must be an array of clean strings — no bullet prefix characters
3. Categorize each skill into the best-fitting category:
   - programmingLanguages: Python, Java, C++, JavaScript, TypeScript, Go, etc.
   - csConcepts: Data Structures, Algorithms, OOP, OS, DBMS, Networking, etc.
   - webDevelopment: React, Next.js, Node.js, HTML, CSS, Django, Flask, Spring, etc.
   - databases: MySQL, MongoDB, PostgreSQL, Redis, Firebase, etc.
   - cloudPlatforms: AWS, Azure, GCP, Docker, Kubernetes, Linux, Git, etc.
   - mlAI: TensorFlow, PyTorch, scikit-learn, NLP, Computer Vision, etc.
   - mobileDevelopment: React Native, Flutter, Android, iOS, Swift, Kotlin, etc.
4. Dates format: "MMM YYYY" e.g. "Jan 2022". If currently active, set current: true and leave endDate as ""
5. Language proficiency: use only "Native", "Professional", or "Basic"
6. If a field is not found, use "" for strings, [] for arrays, false for booleans
7. certifications, achievements, publications are plain string arrays`;

  const raw = await callGemini(prompt, apiKey, { temperature: 0.1, maxOutputTokens: 4096 });
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse resume structure. Please try again.");
  }
}


/**
 * Check ATS score — returns parsed JSON
 */
async function checkATSScore({ jobDescription, resume }, apiKey) {
  const prompt = `You are an ATS (Applicant Tracking System) expert analyst.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resume}

TASK: Analyze how well this resume matches the job description for ATS systems.

Respond with ONLY valid JSON — no markdown, no code fences, no explanation before or after:
{
  "score": <integer 0-100>,
  "grade": "<Excellent|Good|Fair|Poor>",
  "matched_keywords": [<array of 5-10 keyword strings that appear in both JD and resume>],
  "missing_keywords": [<array of 5-10 important keywords from JD missing in resume>],
  "suggestions": "<3-4 specific, actionable improvement suggestions as a single paragraph>"
}

Scoring guide:
- 80-100: Excellent match
- 60-79: Good match  
- 40-59: Fair match (needs improvement)
- 0-39: Poor match (significant gaps)`;

  const raw = await callGemini(prompt, apiKey);

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON from response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse ATS score response. Please try again.");
  }
}
