import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('returns the parsed value when valid', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: 'Loren' })).toEqual({ name: 'Loren' });
  });

  it('throws a BadRequestException when invalid', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });
});
