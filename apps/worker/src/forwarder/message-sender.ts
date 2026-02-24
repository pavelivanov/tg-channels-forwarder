import type { Api } from 'grammy';
import { InputMediaBuilder } from 'grammy';
import type { MessageEntity } from 'grammy/types';
import type pino from 'pino';
import type { ForwardJob, TelegramEntity } from '@aggregator/shared';

export class MessageSender {
  private readonly api: Api;
  private readonly logger: pino.Logger;

  constructor(api: Api, logger: pino.Logger) {
    this.api = api;
    this.logger = logger.child({ service: 'MessageSender' });
  }

  async sendText(chatId: number, text: string, entities?: TelegramEntity[]): Promise<void> {
    await this.api.sendMessage(chatId, text, {
      entities: entities as MessageEntity[] | undefined,
    });
  }

  async sendPhoto(chatId: number, fileId: string, caption?: string, entities?: TelegramEntity[]): Promise<void> {
    await this.api.sendPhoto(chatId, fileId, {
      caption,
      caption_entities: entities as MessageEntity[] | undefined,
    });
  }

  async sendVideo(chatId: number, fileId: string, caption?: string, entities?: TelegramEntity[]): Promise<void> {
    await this.api.sendVideo(chatId, fileId, {
      caption,
      caption_entities: entities as MessageEntity[] | undefined,
    });
  }

  async sendDocument(chatId: number, fileId: string, caption?: string, entities?: TelegramEntity[]): Promise<void> {
    await this.api.sendDocument(chatId, fileId, {
      caption,
      caption_entities: entities as MessageEntity[] | undefined,
    });
  }

  async sendAnimation(chatId: number, fileId: string, caption?: string, entities?: TelegramEntity[]): Promise<void> {
    await this.api.sendAnimation(chatId, fileId, {
      caption,
      caption_entities: entities as MessageEntity[] | undefined,
    });
  }

  async sendAudio(chatId: number, fileId: string, caption?: string, entities?: TelegramEntity[]): Promise<void> {
    await this.api.sendAudio(chatId, fileId, {
      caption,
      caption_entities: entities as MessageEntity[] | undefined,
    });
  }

  async sendAlbum(chatId: number, mediaGroup: ForwardJob[]): Promise<void> {
    const media = mediaGroup.map((item, index) => {
      const isFirst = index === 0;
      const opts = isFirst
        ? { caption: item.caption, caption_entities: item.captionEntities as MessageEntity[] | undefined }
        : {};

      switch (item.mediaType) {
        case 'photo':
          return InputMediaBuilder.photo(item.mediaFileId!, opts);
        case 'video':
          return InputMediaBuilder.video(item.mediaFileId!, opts);
        case 'document':
          return InputMediaBuilder.document(item.mediaFileId!, opts);
        case 'audio':
          return InputMediaBuilder.audio(item.mediaFileId!, opts);
        default:
          return InputMediaBuilder.photo(item.mediaFileId!, opts);
      }
    });

    await this.api.sendMediaGroup(chatId, media);
  }

  private appendSuffix(content: string | undefined, suffix: string, limit: number): string {
    const base = content ?? '';
    const combined = base + suffix;
    if (combined.length <= limit) return combined;
    return base.slice(0, limit - suffix.length) + suffix;
  }

  async send(chatId: number, job: ForwardJob, sourceLabel?: string): Promise<void> {
    const suffix = sourceLabel ? `\n\nfrom ${sourceLabel}` : '';

    if (job.mediaGroup && job.mediaGroup.length > 0) {
      if (suffix) {
        const first = job.mediaGroup[0];
        const patched = { ...first, caption: this.appendSuffix(first.caption, suffix, 1024) };
        await this.sendAlbum(chatId, [patched, ...job.mediaGroup.slice(1)]);
      } else {
        await this.sendAlbum(chatId, job.mediaGroup);
      }
      return;
    }

    switch (job.mediaType) {
      case 'photo': {
        const caption = suffix ? this.appendSuffix(job.caption, suffix, 1024) : job.caption;
        await this.sendPhoto(chatId, job.mediaFileId!, caption, job.captionEntities);
        break;
      }
      case 'video': {
        const caption = suffix ? this.appendSuffix(job.caption, suffix, 1024) : job.caption;
        await this.sendVideo(chatId, job.mediaFileId!, caption, job.captionEntities);
        break;
      }
      case 'document': {
        const caption = suffix ? this.appendSuffix(job.caption, suffix, 1024) : job.caption;
        await this.sendDocument(chatId, job.mediaFileId!, caption, job.captionEntities);
        break;
      }
      case 'animation': {
        const caption = suffix ? this.appendSuffix(job.caption, suffix, 1024) : job.caption;
        await this.sendAnimation(chatId, job.mediaFileId!, caption, job.captionEntities);
        break;
      }
      case 'audio': {
        const caption = suffix ? this.appendSuffix(job.caption, suffix, 1024) : job.caption;
        await this.sendAudio(chatId, job.mediaFileId!, caption, job.captionEntities);
        break;
      }
      default: {
        const text = suffix ? this.appendSuffix(job.text, suffix, 4096) : (job.text ?? '');
        await this.sendText(chatId, text, job.entities);
        break;
      }
    }
  }
}
