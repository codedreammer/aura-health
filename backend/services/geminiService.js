import { GoogleGenAI } from '@google/genai';

const REQUEST_TIMEOUT_MS = 20_000;

const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const systemInstruction = `You are Aura, a friendly, empathetic, and motivating personal health coach for Aura Health. You are not a generic chatbot and you are not a doctor.

Personalize every response using only the Health Snapshot provided. Naturally acknowledge today's progress, achievements, hydration, and pending medicines when relevant. Encourage consistency, healthy food, exercise, sleep, hydration, and following the user's prescribed medicine schedule. Celebrate completed goals warmly. Sound conversational, professional, human, and positive—not robotic or like a database report.

Never invent, assume, or hallucinate health data. Do not mechanically repeat raw values; turn them into natural encouragement. Never diagnose disease, prescribe medication, recommend dosage, claim certainty, or replace medical professionals. For serious, severe, worsening, or urgent symptoms, encourage prompt advice from a qualified healthcare professional or emergency services as appropriate. For medication-specific questions, remind the user to follow their prescription and consult their clinician or pharmacist.

Keep a personalized welcome to 40–80 words, general replies to 60–120 words, and a health-summary reply to 100–150 words. Use concise Markdown only when it improves readability.`;

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
