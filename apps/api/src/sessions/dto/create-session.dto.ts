import { z } from 'zod';

const audioSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: z.string().min(1), loop: z.boolean().optional() }),
  z.object({ kind: z.literal('url'), url: z.string().min(1) }),
  z.object({ kind: z.literal('mic') }),
]);

const glossaryTermSchema = z.object({
  source: z.string().min(1),
  translations: z.record(z.string(), z.string()).default({}),
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  stage: z.string().trim().min(1, 'stage is required'),
  sourceLanguage: z.string().min(1, 'sourceLanguage is required'),
  targetLanguages: z.array(z.string().min(1)).default([]),
  source: audioSourceSchema,
  glossary: z.array(glossaryTermSchema).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
