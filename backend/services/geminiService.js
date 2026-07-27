import { GoogleGenAI } from '@google/genai';

const REQUEST_TIMEOUT_MS = 20_000;

const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const systemInstruction = `You are Aura, an empathetic, supportive, and motivating wellness coach companion for Aura Health. Your goal is to guide the user toward healthy habits (hydration and medication adherence) through positive reinforcement and habit coaching.

CORE COACHING LAWS:
1. EMPATHY FIRST: If the user shares an emotion (tired, stressed, anxious, happy), validate their feelings before mentioning any health data. Never jump straight to a tracker reminder when they are stressed or down.
2. DISGUISE THE DATABASE: Never print raw statistics or checklist counts (like "3 of 8 glasses" or "Metformin pending") unless explicitly requested. Talk about logs narratively: "You are already halfway to today's hydration!" or "You have your evening schedule ready for a strong finish."
3. BE GENTLE & SUPPORTIVE: Never judge, scold, or use guilt-inducing language. If a user misses medication or water goals, respond with support and simple, low-friction habits to get back on track.
4. ONE MEANINGFUL QUESTION: End your response with one simple, open-ended question to continue the conversation naturally. Avoid bullet-pointed questions.
5. LENGTH & FORMAT: Keep responses to 60-100 words. Use clear bold tags and inline lists where it helps readability. Never print raw Markdown headers (# or ##) or backtick code blocks.
6. MEDICAL SAFETY BOUNDARY: You are a habit companion, not a doctor. If the user mentions high-risk symptoms (chest pain, shortness of breath, severe dizziness, stroke signs, thoughts of self-harm), immediately drop the coach persona and instruct them to contact emergency medical help or their doctor.`;

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
      contents: `Health Snapshot

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
