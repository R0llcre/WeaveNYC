import { speechTranscribeResponseSchema as speechTranscribeSchema } from '@weavenyc/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  errorResponseSchema,
  speechTranscribeResponseSchema,
} from '../contracts.js';

export const speechRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/v1/speech/transcribe',
    {
      schema: {
        summary: 'Transcribe a short voice note through the server fallback provider',
        tags: ['speech'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          200: speechTranscribeResponseSchema,
          400: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parts = request.parts();
      let audio: Buffer | null = null;
      let filename: string | undefined;
      let mimeType: string | undefined;
      let language: 'en' | 'es' | 'zh' = 'en';
      let transcriptHint: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname !== 'audio') {
            continue;
          }

          filename = part.filename;
          mimeType = part.mimetype;
          audio = await part.toBuffer();
          continue;
        }

        if (part.fieldname === 'language' && (part.value === 'en' || part.value === 'es' || part.value === 'zh')) {
          language = part.value;
        }

        if (part.fieldname === 'transcript_hint') {
          transcriptHint = String(part.value ?? '').trim() || undefined;
        }
      }

      if (!audio) {
        reply.code(400);
        return { message: 'audio file is required' };
      }

      const transcription = await app.speechProvider.transcribe({
        audio,
        filename,
        mimeType,
        languageHint: language,
        transcriptHint,
      });

      return speechTranscribeSchema.parse(transcription);
    }
  );
};
