// ── GEMINI API UTILITY ──
// Supports gemini-2.0-flash (default) with easy model switching

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Core Gemini API call
 */
async function callGemini(prompt, apiKey) {
  const response = await fetch(GEMINI_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
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
