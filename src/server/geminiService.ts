/**
 * Server-side Gemini AI integration using @google/genai
 * Strictly server-side; lazy initialized; gracefully degrades to deterministic rules
 * Resilient to 503 / high demand spikes with fallback models and retry backoff.
 */

import { GoogleGenAI } from '@google/genai';
import { OfferComparison } from '../types/insurance';

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.warn('Failed to initialize GoogleGenAI client:', e);
      aiClient = null;
    }
  }
  return aiClient;
}

/**
 * High-quality deterministic explanation fallback
 * Ensures instant, complete, zero-dependency explanations if AI is unavailable or under heavy load
 */
export function generateDeterministicExplanation(comparison: OfferComparison): string {
  if (comparison.classification === 'BASELINE_MATCH') {
    return `This offer has matching documented coverage and an annual premium $${Math.abs(comparison.annualPremiumDifference).toLocaleString()} ${comparison.annualPremiumDifference >= 0 ? 'lower' : 'higher'} than the verified baseline.`;
  }
  if (comparison.classification === 'BASELINE_PLUS') {
    const upgradeNames = comparison.materialImprovements.map(m => m.fieldName).join(', ');
    return `This offer has an annual premium $${Math.abs(comparison.annualPremiumDifference).toLocaleString()} ${comparison.annualPremiumDifference >= 0 ? 'lower' : 'higher'} than the verified baseline and documents these additional coverages: ${upgradeNames}.`;
  }
  if (comparison.classification === 'COVERAGE_CHANGED') {
    const cuts = comparison.materialReductions.map(m => `${m.fieldName} (${m.baselineValueFormatted} → ${m.offerValueFormatted})`).join('; ');
    return `Coverage differs from the verified baseline. The annual premium is $${Math.abs(comparison.annualPremiumDifference).toLocaleString()} ${comparison.annualPremiumDifference >= 0 ? 'lower' : 'higher'}, and these documented coverage reductions require review: ${cuts}.`;
  }
  return `This offer contains unverified or ambiguous terms that require human verification before you make a commitment.`;
}

/**
 * Generate plain-language consumer explanation of coverage differences
 * AI is an assistant: strictly deterministic comparisons govern the outcome,
 * and AI provides accessible explanations.
 */
export async function explainCoverageComparison(
  comparison: OfferComparison
): Promise<string> {
  const fallback = generateDeterministicExplanation(comparison);
  const ai = getAI();

  if (!ai) {
    return fallback;
  }

  const prompt = `You are the plain-language consumer assistant for Open Policy, a policy review platform.
Explain this insurance offer to the consumer in 2-3 objective, clear sentences without marketing fluff or insurance jargon.

Offer Carrier: ${comparison.carrier}
Current Annual Premium: $${comparison.currentAnnualPremium}
Offer Annual Premium: $${comparison.offerAnnualPremium}
Annual Premium Difference (baseline minus offer): $${comparison.annualPremiumDifference}
Classification: ${comparison.classification}
Material Reductions: ${JSON.stringify(comparison.materialReductions.map(r => ({ name: r.fieldName, from: r.baselineValueFormatted, to: r.offerValueFormatted })))}
Material Improvements: ${JSON.stringify(comparison.materialImprovements.map(r => ({ name: r.fieldName, from: r.baselineValueFormatted, to: r.offerValueFormatted })))}

Rule: Prominently disclose if coverage was cut. Never praise an offer simply for being cheaper if coverage was removed or deductibles were raised.`;

  // Attempt primary model: gemini-3.6-flash (recommended high-availability model), with fallback to gemini-3.8-flash
  const modelsToTry = ['gemini-3.6-flash', 'gemini-3.8-flash'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err: any) {
      const status = err?.status || err?.code || err?.error?.code || 'unknown';
      console.log(`[Open Policy AI] Model ${model} returned status ${status}; using next fallback.`);

      if (model === modelsToTry[0]) {
        // Brief pause before trying secondary model
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
    }
  }

  // Graceful degradation to verified deterministic explanation
  return fallback;
}
