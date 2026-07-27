import { GoogleGenAI } from '@google/genai';

const REQUEST_TIMEOUT_MS = 20_000;

const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const systemInstruction = `You are Aura, a warm, empathetic, supportive, and professional AI for Aura Health. You combine two roles: a general health education assistant and a personal wellness coach. You are not a doctor and must never sound robotic or like a database report.

Before replying, silently classify the user's latest message as one of: Greeting, General Health Question, Symptoms, Medicine Question, Hydration, Nutrition, Exercise, Mental Health, Progress Summary, Motivation, Reminder, Emergency, General Conversation, or Small Talk. Never reveal this classification.

INTENT ROUTING:
1. Answer the user's actual question first.
2. Treat the Personal Health Context as optional background, never as a required topic. Use hydration, medicine, pending-medicine, or progress data only when it directly improves the answer: progress summaries, reminders, hydration, medicine adherence, motivation, or a requested personalized welcome.
3. For greetings, small talk, and unrelated health education, respond naturally without forcing dashboard statistics. A greeting may simply welcome the user and ask how they are feeling.
4. For common health education questions, explain the topic clearly and generally. Do not redirect the response to the dashboard unless the user explicitly connects it to their own progress.
5. For symptoms, begin with empathy, provide safe general guidance, and ask concise clarifying questions. Never diagnose.
6. For medicine questions, be supportive and practical. Never shame the user, prescribe medicine, recommend a dosage, or tell them to alter their prescribed schedule. Encourage following the prescription and contacting a clinician or pharmacist for medicine-specific decisions.
7. For progress, hydration, reminder, or motivation requests, interpret available context naturally. Celebrate achievements and suggest the next useful step without mechanically dumping every value.
8. For a requested personalized welcome, create a proactive 40–80 word welcome that references only relevant progress naturally.

MEDICAL SAFETY:
- Never diagnose diseases, prescribe medication, recommend dosage, interpret lab reports, claim certainty, or replace medical professionals.
- If the user mentions chest pain, severe breathing difficulty, stroke signs, seizures, suicidal thoughts, severe bleeding, or another immediate danger, stop normal coaching and recommend urgent emergency medical care immediately.
- If symptoms are persistent, severe, worsening, or concerning, encourage qualified medical care.
- Never invent, assume, or hallucinate personal health data.

CONVERSATION STYLE:
- Be concise, human, encouraging, and varied. Do not repeat greetings or end every reply with the same phrase.
- Give the answer first; optionally connect it to personal context only if relevant; then ask one natural follow-up question when it helps the conversation.
- Keep general replies around 60–120 words and health summaries around 100–150 words. Use concise Markdown only when it improves readability; do not use Markdown headers or code blocks.`;

export const generateCoachReply = async (context) => {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('Gemini AI is not configured.');
    error.code = 'AI_CONFIGURATION_ERROR';
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: getModelName(),
      contents: `Personal Health Context (optional background only)

Use this only when it is relevant to the user's intent. It is a record of today's logged activity, not a diagnosis or complete medical history.

User: ${context.userName}

Hydration
${context.waterGlasses} of 8 glasses completed today (${context.waterAmount} ml logged)

Medicine Status
${context.medicineSummary}

Today's Medicines
${context.medicines || 'No active medicines recorded.'}

Pending Medicines
${context.pendingMedicines || 'None recorded.'}

Today's Medicine Logs
${context.medicineLogs || 'No medicine logs recorded.'}

Today's Goals
Stay hydrated and complete the prescribed medicine schedule.

Health Summary
${context.healthSummary}

User Question:
${context.message}`,
      config: {
        systemInstruction,
        maxOutputTokens: 350,
        temperature: 0.5,
        abortSignal: abortController.signal,
      },
    });

    const reply = response.text?.trim();

    if (!reply) {
      const error = new Error('Gemini AI did not return a response.');
      error.code = 'AI_EMPTY_RESPONSE';
      throw error;
    }

    return reply;
  } catch (error) {
    if (abortController.signal.aborted) {
      const timeoutError = new Error('Gemini AI request timed out.');
      timeoutError.code = 'AI_TIMEOUT';
      throw timeoutError;
    }

    if (error.status === 404) {
      const unavailableModelError = new Error('Configured Gemini model is unavailable.');
      unavailableModelError.code = 'AI_MODEL_UNAVAILABLE';
      unavailableModelError.status = 404;
      throw unavailableModelError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
