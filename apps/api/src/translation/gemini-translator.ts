import type { Glossary, LanguageCode, TranscriptSegment, TranslatorPort } from '@subs/domain';
import type { GeminiTextClient, GeminiTranslationRequest } from './gemini-client.js';

const SYSTEM_INSTRUCTION =
  'You are a translator for live captions at a technical conference. ' +
  'Preserve technical terms, proper nouns, and code snippets exactly as written, ' +
  'without translating them. Reply with only the translated sentence, no quotes, ' +
  'no explanations, and no extra commentary.';

const TEMPERATURE = 0.2;
/** Flash-lite answers in ~1 s, but demand spikes (503/504) can take several seconds.
 * Note: Google GenAI API requires a minimum deadline of 10s if manually set. */
const TIMEOUT_MS = 12000;
/** Initial attempt + 2 retries. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
/** Number of previous original sentences kept as context, per session. */
const CONTEXT_SIZE = 2;

/**
 * Translates transcript segments with Gemini, using the session's glossary and the last
 * couple of original sentences as context for coherence.
 */
export class GeminiTranslator implements TranslatorPort {
  /** sessionId -> last `CONTEXT_SIZE` original sentences, oldest first. */
  private readonly context = new Map<string, string[]>();

  constructor(
    private readonly client: GeminiTextClient,
    private readonly model: string,
  ) {}

  async translate(
    segment: TranscriptSegment,
    target: LanguageCode,
    glossary: Glossary,
  ): Promise<TranscriptSegment> {
    if (segment.language.equals(target)) return segment;

    const sessionKey = segment.sessionId.value;
    const contextSentences = this.context.get(sessionKey) ?? [];
    const prompt = this.buildPrompt(segment, target, glossary, contextSentences);

    const translatedText = await this.generateWithRetry({
      model: this.model,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt,
      temperature: TEMPERATURE,
      timeoutMs: TIMEOUT_MS,
    });

    this.rememberContext(sessionKey, segment.text);

    return segment.translate(target, translatedText.trim());
  }

  private buildPrompt(
    segment: TranscriptSegment,
    target: LanguageCode,
    glossary: Glossary,
    contextSentences: readonly string[],
  ): string {
    const sections: string[] = [];

    const glossarySection = glossary.toPromptSection(target);
    if (glossarySection) sections.push(glossarySection);

    if (contextSentences.length > 0) {
      sections.push(
        [
          'Context (previous original sentences from this session, do not translate them):',
          ...contextSentences.map((sentence) => `- ${sentence}`),
        ].join('\n'),
      );
    }

    sections.push(
      `Translate the following sentence from ${segment.language.value} to ${target.value}. ` +
        'Output only the translated sentence.',
    );
    sections.push(segment.text);

    return sections.join('\n\n');
  }

  private rememberContext(sessionKey: string, text: string): void {
    const updated = [...(this.context.get(sessionKey) ?? []), text].slice(-CONTEXT_SIZE);
    this.context.set(sessionKey, updated);
  }

  private async generateWithRetry(request: GeminiTranslationRequest): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.callWithTimeout(request);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS * attempt);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Gemini translation failed after ${MAX_ATTEMPTS} attempts: ${reason}`);
  }

  private async callWithTimeout(request: GeminiTranslationRequest): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Gemini translation timed out after ${request.timeoutMs}ms`));
      }, request.timeoutMs);

      this.client.generateText(request).then(
        (text) => {
          clearTimeout(timer);
          resolve(text);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }
}

const delay = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
