import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Glossary,
  LanguageCode,
  Session,
  SessionId,
  type CaptionDto,
  type ExportFormat,
  type SessionDto,
  type SessionRepository,
  type SessionRunner,
  type TranscriptRepository,
} from '@subs/domain';
import { SESSION_REPOSITORY, SESSION_RUNNER, TRANSCRIPT_REPOSITORY } from '../shared/tokens.js';
import type { CreateSessionInput } from './dto/create-session.dto.js';
import { TRANSCRIPT_EXPORTERS, type TranscriptExporterMap } from './exporters/index.js';

export interface SessionExport {
  filename: string;
  mimeType: string;
  content: string;
}

const sanitizeFilenamePart = (value: string): string => value.replace(/["\r\n]/g, '');

@Injectable()
export class SessionsService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepository,
    @Inject(SESSION_RUNNER) private readonly runner: SessionRunner,
    @Inject(TRANSCRIPT_EXPORTERS) private readonly exporters: TranscriptExporterMap,
  ) {}

  async create(input: CreateSessionInput): Promise<SessionDto> {
    const session = Session.create({
      title: input.title,
      stage: input.stage,
      sourceLanguage: LanguageCode.of(input.sourceLanguage),
      targetLanguages: input.targetLanguages.map((lang) => LanguageCode.of(lang)),
      source: input.source,
      glossary: input.glossary ? Glossary.fromDto(input.glossary) : undefined,
    });
    await this.sessions.save(session);
    return session.toSnapshot();
  }

  async findAll(): Promise<SessionDto[]> {
    const sessions = await this.sessions.findAll();
    return sessions.map((session) => session.toSnapshot());
  }

  async findOne(id: string): Promise<SessionDto> {
    const session = await this.getOrThrow(id);
    return session.toSnapshot();
  }

  async start(id: string): Promise<SessionDto> {
    const session = await this.getOrThrow(id);
    await this.runner.start(session.id);
    return this.findOne(id);
  }

  async stop(id: string): Promise<SessionDto> {
    const session = await this.getOrThrow(id);
    await this.runner.stop(session.id);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const session = await this.getOrThrow(id);
    await this.sessions.delete(session.id);
  }

  async transcript(id: string, lang: string): Promise<CaptionDto[]> {
    const session = await this.getOrThrow(id);
    const language = LanguageCode.of(lang);
    const transcript = await this.transcripts.get(session.id);
    return transcript.forLanguage(language).map((segment) => segment.toDto());
  }

  async export(id: string, lang: string, format: string): Promise<SessionExport> {
    const session = await this.getOrThrow(id);
    const language = LanguageCode.of(lang);
    const exporter = this.exporters[format as ExportFormat];
    if (!exporter) {
      throw new BadRequestException(`Unsupported export format "${format}"`);
    }
    const transcript = await this.transcripts.get(session.id);
    const segments = transcript.forLanguage(language);
    const content = exporter.export(segments);
    const filename = `${sanitizeFilenamePart(session.title)}-${language.value}.${exporter.format}`;
    return { filename, mimeType: exporter.mimeType, content };
  }

  private async getOrThrow(id: string): Promise<Session> {
    const session = await this.sessions.findById(SessionId.of(id));
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return session;
  }
}
