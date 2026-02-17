# Contract: MessageSender

## Overview

`MessageSender` wraps the grammY `Api` to provide typed send methods for each media type. Isolates Telegram API surface from business logic.

**Location**: `apps/worker/src/forwarder/message-sender.ts`

## Class Interface

```typescript
class MessageSender {
  constructor(api: Api, logger: pino.Logger)

  /** Send a text message with entities */
  async sendText(chatId: number, text: string, entities?: MessageEntity[]): Promise<void>

  /** Send a photo with optional caption and entities */
  async sendPhoto(chatId: number, fileId: string, caption?: string, entities?: MessageEntity[]): Promise<void>

  /** Send a video with optional caption and entities */
  async sendVideo(chatId: number, fileId: string, caption?: string, entities?: MessageEntity[]): Promise<void>

  /** Send a document with optional caption and entities */
  async sendDocument(chatId: number, fileId: string, caption?: string, entities?: MessageEntity[]): Promise<void>

  /** Send an animation (GIF) with optional caption */
  async sendAnimation(chatId: number, fileId: string, caption?: string, entities?: MessageEntity[]): Promise<void>

  /** Send an audio file with optional caption */
  async sendAudio(chatId: number, fileId: string, caption?: string, entities?: MessageEntity[]): Promise<void>

  /** Send a media group (album) */
  async sendAlbum(chatId: number, mediaGroup: ForwardJob[]): Promise<void>

  /** Dispatch a ForwardJob to the appropriate send method */
  async send(chatId: number, job: ForwardJob): Promise<void>
}
```

## Method: `send(chatId, job)`

Routes based on `job.mediaGroup` and `job.mediaType`:

| Condition | Method Called |
|-----------|-------------|
| `job.mediaGroup` is non-empty | `sendAlbum(chatId, job.mediaGroup)` |
| `job.mediaType === 'photo'` | `sendPhoto(chatId, fileId, caption, entities)` |
| `job.mediaType === 'video'` | `sendVideo(chatId, fileId, caption, entities)` |
| `job.mediaType === 'document'` | `sendDocument(chatId, fileId, caption, entities)` |
| `job.mediaType === 'animation'` | `sendAnimation(chatId, fileId, caption, entities)` |
| `job.mediaType === 'audio'` | `sendAudio(chatId, fileId, caption, entities)` |
| No media (text only) | `sendText(chatId, text, entities)` |

## Album Handling

`sendAlbum` maps each `ForwardJob` in the `mediaGroup` array to an `InputMedia` object:

| mediaType | InputMedia Builder |
|-----------|-------------------|
| photo | `InputMediaBuilder.photo(fileId, { caption, caption_entities })` |
| video | `InputMediaBuilder.video(fileId, { caption, caption_entities })` |
| document | `InputMediaBuilder.document(fileId, { caption, caption_entities })` |
| audio | `InputMediaBuilder.audio(fileId, { caption, caption_entities })` |

Only the first item in the album carries the caption (Telegram convention).

Calls `api.sendMediaGroup(chatId, media)`.
