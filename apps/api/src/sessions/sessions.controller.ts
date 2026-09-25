import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { CaptionDto, SessionDto } from '@subs/domain';
import type { Response } from 'express';
import { createSessionSchema, type CreateSessionInput } from './dto/create-session.dto.js';
import { ZodValidationPipe } from './pipes/zod-validation.pipe.js';
import { SessionsService } from './sessions.service.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  findAll(): Promise<SessionDto[]> {
    return this.sessions.findAll();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createSessionSchema)) body: CreateSessionInput,
  ): Promise<SessionDto> {
    return this.sessions.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SessionDto> {
    return this.sessions.findOne(id);
  }

  @Post(':id/start')
  start(@Param('id') id: string): Promise<SessionDto> {
    return this.sessions.start(id);
  }

  @Post(':id/stop')
  stop(@Param('id') id: string): Promise<SessionDto> {
    return this.sessions.stop(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.sessions.remove(id);
  }

  @Get(':id/transcript')
  transcript(@Param('id') id: string, @Query('lang') lang = ''): Promise<CaptionDto[]> {
    return this.sessions.transcript(id, lang);
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('lang') lang = '',
    @Query('format') format = '',
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const result = await this.sessions.export(id, lang, format);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    return result.content;
  }
}
