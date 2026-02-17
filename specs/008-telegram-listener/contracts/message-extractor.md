# Contract: Message Extractor

**Location**: `apps/worker/src/listener/message-extractor.ts`

## Overview

Pure function module that converts a GramJS `Api.Message` into a `ForwardJob` payload. Handles all supported media types.

## Functions

### `extractForwardJob(message: Api.Message): ForwardJob`

Maps a GramJS message to the shared `ForwardJob` interface.

```typescript
function extractForwardJob(message: Api.Message): ForwardJob {
  return {
    messageId: message.id,
    sourceChannelId: getChannelId(message),
    text: message.message || undefined,
    caption: getCaption(message),
    mediaType: getMediaType(message),
    mediaFileId: getMediaFileId(message),
    mediaGroupId: message.groupedId?.toString(),
    timestamp: message.date,
  };
}
```

### `getChannelId(message: Api.Message): number`

Extracts the numeric channel ID from `message.peerId`.

```typescript
// message.peerId is an Api.PeerChannel with channelId property
```

### `getMediaType(message: Api.Message): string | undefined`

Determines the media type from message accessors.

| Check | Returns |
|-------|---------|
| `message.photo` | `"photo"` |
| `message.video` | `"video"` |
| `message.document` (not gif/audio/voice/videoNote) | `"document"` |
| `message.gif` | `"animation"` |
| `message.audio` | `"audio"` |
| `message.sticker` | `"sticker"` |
| `message.voice` | `"voice"` |
| `message.videoNote` | `"video_note"` |
| none | `undefined` |

Order matters — check specific types before generic `document`.

### `getMediaFileId(message: Api.Message): string | undefined`

Serializes the media identifier for downstream use.

- For `Api.Photo`: `"photo:{id}:{accessHash}"`
- For `Api.Document`: `"document:{id}:{accessHash}"`
- Returns `undefined` if no media

### `getCaption(message: Api.Message): string | undefined`

Returns the message text when a media message has text (which is the caption), or `undefined` for pure text messages or no-caption media.

## Supported Types (FR-016)

text, photo, video, document, animation, audio, sticker, voice, video_note

## Notes

- Service messages (no text, no media) are filtered out upstream in `handleNewMessage`
- `message.date` is Unix epoch seconds (not milliseconds)
- `groupedId` is a BigInteger in GramJS — convert to string for ForwardJob
