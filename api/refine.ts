import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODELS } from '../src/config/aiBudget.js';

export const maxDuration = 20;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Fail-safe response — used on any error/timeout so refinement never blocks analysis.
const PASSTHROUGH = { needsRefinement: false };

enum Type {
  STRING = 'STRING', BOOLEAN = 'BOOLEAN', OBJECT = 'OBJECT', ARRAY = 'ARRAY',
}

const refinementSchema = {
  type: Type.OBJECT,
  properties: {
    needsRefinement: { type: Type.BOOLEAN },
    question: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
        required: ['label', 'value'],
      },
    },
  },
  required: ['needsRefinement'],
};

const SYSTEM_PROMPT = `You are a business classification assistant for BizScope, a market analysis tool.

Your ONLY job: determine whether a user's business description is broad enough that asking for a more specific concept would materially improve a location-specific business viability analysis.

A concept needs refinement when it encompasses multiple COMMERCIALLY DISTINCT business models that would have meaningfully different:
- Target customers
- Competitors and competitive landscape
- Pricing and revenue model
- Physical or operational requirements
- Market demand and growth trajectories

IMPORTANT RULES:
1. Return needsRefinement: false for concepts that are already specific (e.g. "Yemeni coffee shop", "artisan sourdough bakery", "Korean BBQ restaurant", "women-only strength gym", "Montessori preschool", "mobile dog grooming").
2. Return needsRefinement: false for franchise/brand names (e.g. "Chick-fil-A", "McDonald's", "Subway") — these are already specific enough.
3. Return needsRefinement: true ONLY for genuinely broad categories where the subcategory meaningfully changes the analysis (e.g. "coffee shop", "bakery", "restaurant", "gym", "daycare", "auto repair shop").
4. When needsRefinement is true, provide 3–6 COMMERCIALLY DISTINCT options. Each option must:
   - Represent a meaningfully different business model (NOT just synonyms like "coffee shop / café / coffee house")
   - Be a real, commercially recognized concept
   - Affect competitors, customers, pricing, or operating model differently
5. The question field should be conversational and specific, e.g. "What kind of coffee shop are you considering?"
6. NEVER comment on viability, market conditions, or whether an idea is good or bad.
7. NEVER include "Keep it general" or "Other" in your options — those are added automatically by the UI.`;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body: { businessType?: unknown; location?: unknown };
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return json(res, 400, { error: 'Invalid JSON' });
  }

  const businessType = typeof body.businessType === 'string' ? body.businessType.trim() : '';
  if (!businessType || businessType.length > 200) {
    return json(res, 400, { error: 'businessType is required (max 200 chars)' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No API key — fail safe, don't block analysis.
    return json(res, 200, PASSTHROUGH);
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    let rawJson: string;
    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODELS.standard,
        contents: [
          {
            role: 'user',
            parts: [{
              text: `Business concept: "${businessType}"\n\nShould BizScope ask the user to narrow this down before running the viability analysis? Apply your classification rules and respond with valid JSON only.`,
            }],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: refinementSchema as any,
          temperature: 0.1,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      clearTimeout(timeoutId);
      rawJson = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (callErr: any) {
      clearTimeout(timeoutId);
      if (callErr?.name === 'AbortError' || String(callErr?.message).includes('abort')) {
        console.warn('[refine] Gemini call timed out — passing through');
      } else {
        console.warn('[refine] Gemini call failed:', callErr?.message);
      }
      return json(res, 200, PASSTHROUGH);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      console.warn('[refine] JSON parse failed for response:', rawJson?.slice(0, 200));
      return json(res, 200, PASSTHROUGH);
    }

    // Validate structure
    if (typeof parsed?.needsRefinement !== 'boolean') {
      return json(res, 200, PASSTHROUGH);
    }

    if (!parsed.needsRefinement) {
      return json(res, 200, { needsRefinement: false });
    }

    // Validate options if refinement is needed
    const options = Array.isArray(parsed.options) ? parsed.options : [];
    const validOptions = options
      .filter((o: any) => typeof o?.label === 'string' && typeof o?.value === 'string')
      .map((o: any) => ({ label: o.label.trim(), value: o.value.trim() }))
      .filter((o: any) => o.label.length > 0 && o.value.length > 0)
      .slice(0, 6);

    // If AI says refinement needed but returned no valid options, pass through.
    if (validOptions.length < 2) {
      return json(res, 200, PASSTHROUGH);
    }

    return json(res, 200, {
      needsRefinement: true,
      question: typeof parsed.question === 'string' && parsed.question.trim()
        ? parsed.question.trim()
        : `What kind of ${businessType.toLowerCase()} are you considering?`,
      options: validOptions,
    });
  } catch (err: any) {
    console.error('[refine] Unexpected error:', err?.message);
    return json(res, 200, PASSTHROUGH);
  }
}
