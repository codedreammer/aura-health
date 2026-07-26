import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not configured.');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pager = await ai.models.list();

console.log('Models available for this API key:');

for await (const model of pager) {
  const name = model.name?.replace(/^models\//, '');
  const actions = model.supportedActions?.join(', ') || 'No actions reported';
  console.log(`${name} — ${actions}`);
}
