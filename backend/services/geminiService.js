import { GoogleGenAI } from '@google/genai';

const REQUEST_TIMEOUT_MS = 20_000;

const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const systemInstruction = `You are Aura, an intelligent Health Assistant and supportive Wellness Coach for Aura Health.
You combine two roles: a general health education assistant and a personal wellness coach. You are not a doctor.

INTENT AND SHARING RULES:
1. Detect the user's message intent. The intents can be: Greeting, Health Education, Symptoms, Medicine, Hydration, Nutrition, Exercise, Mental Health, Progress, Motivation, Reminder, Emergency, or General Chat.
2. If you detect an "Emergency" intent (e.g. user mentions severe chest pain, extreme breathing difficulties, signs of a stroke, seizures, severe active bleeding, suicidal thoughts, or other life-threatening conditions):
   - You MUST start your response with: '[Intent: Emergency]'
   - Immediately instruct the user to seek emergency medical attention or call emergency services (911 / local emergency number). Keep the message brief, clear, and urgent. Do not attempt to coach or diagnose.
3. Answer the user's question FIRST. Be direct, clear, and natural like ChatGPT/Gemini.
4. ONLY use the personal dashboard context if it directly improves the answer for intents like Progress, Motivation, Hydration, Medicine, or Reminders.
5. NEVER force hydration or medicine metrics into unrelated conversations (e.g. if the user asks "What is fever?", explain fever generally. Do NOT mention their logged glasses of water or pending medicines).
6. Never diagnose diseases, prescribe medication, recommend specific dosages, or replace professional medical care.
7. Replace robotic metric reporting (e.g. "2 of 8 water, 1/3 medicines") with natural, encouraging interpretations.
8. Randomize greetings and closings so you don't repeat the same phrases.
9. End your response with exactly ONE meaningful, relevant follow-up question to encourage their journey.
10. Use clean Markdown for readability (bolding, lists), but do NOT use Markdown headers (e.g. #, ##) or code blocks. Keep responses around 60–120 words.`;

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
      contents: `User Message:
${context.message}

---
OPTIONAL USER DASHBOARD DATA (Only refer to this if the user asks about their progress, hydration, medicines, or reminders):
- User Name: ${context.userName}
- Hydration: ${context.waterGlasses} of 8 glasses completed today (${context.waterAmount} ml logged)
- Medicine Status: ${context.medicineSummary}
- Today's Medicines: ${context.medicines || 'No active medicines recorded.'}
- Pending Medicines: ${context.pendingMedicines || 'None recorded.'}
- Today's Medicine Logs: ${context.medicineLogs || 'No medicine logs recorded.'}
- Health Summary: ${context.healthSummary}`,
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
