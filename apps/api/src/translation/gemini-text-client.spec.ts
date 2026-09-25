import { GoogleGenAiTextClient } from './gemini-text-client.js';

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function FakeGoogleGenAI() {
    return { models: { generateContent } };
  }),
}));

describe('GoogleGenAiTextClient', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('forwards model, prompt, system instruction, temperature and timeout to the SDK', async () => {
    generateContent.mockResolvedValue({ text: 'Hola mundo' });
    const client = new GoogleGenAiTextClient('test-key');

    const text = await client.generateText({
      model: 'gemini-2.5-flash',
      systemInstruction: 'translate captions',
      prompt: 'Hello world',
      temperature: 0.2,
      timeoutMs: 5000,
    });

    expect(text).toBe('Hola mundo');
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: 'Hello world',
      config: {
        systemInstruction: 'translate captions',
        temperature: 0.2,
        httpOptions: { timeout: 5000 },
      },
    });
  });

  it('throws when the SDK returns no text', async () => {
    generateContent.mockResolvedValue({ text: undefined });
    const client = new GoogleGenAiTextClient('test-key');

    await expect(
      client.generateText({
        model: 'gemini-2.5-flash',
        systemInstruction: 'translate captions',
        prompt: 'Hello world',
        temperature: 0.2,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(/empty translation/);
  });
});
