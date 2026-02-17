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

  async send(chatId: number, job: ForwardJob): Promise<void> {
    if (job.mediaGroup && job.mediaGroup.length > 0) {
      await this.sendAlbum(chatId, job.mediaGroup);
      return;
    }

    switch (job.mediaType) {
      case 'photo':
        await this.sendPhoto(chatId, job.mediaFileId!, job.caption, job.captionEntities);
        break;
      case 'video':
        await this.sendVideo(chatId, job.mediaFileId!, job.caption, job.captionEntities);
        break;
      case 'document':
        await this.sendDocument(chatId, job.mediaFileId!, job.caption, job.captionEntities);
        break;
      case 'animation':
        await this.sendAnimation(chatId, job.mediaFileId!, job.caption, job.captionEntities);
        break;
      case 'audio':
        await this.sendAudio(chatId, job.mediaFileId!, job.caption, job.captionEntities);
        break;
      default:
        await this.sendText(chatId, job.text ?? '', job.entities);
        break;
    }
  }
}
