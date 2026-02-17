import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';
import { ALBUM_GROUP_TIMEOUT_MS, ALBUM_MAX_SIZE } from '@aggregator/shared';

interface AlbumGroup {
  messages: ForwardJob[];
  timer: NodeJS.Timeout;
}

export class AlbumGrouper {
  private readonly groups = new Map<string, AlbumGroup>();
  private readonly logger: pino.Logger;

  constructor(
    private readonly onFlush: (job: ForwardJob) => Promise<void>,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'AlbumGrouper' });
  }

  addMessage(job: ForwardJob): void {
    const groupId = job.mediaGroupId!;
    const existing = this.groups.get(groupId);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(job);

      if (existing.messages.length >= ALBUM_MAX_SIZE) {
        this.flush(groupId);
        return;
      }

      existing.timer = setTimeout(() => this.flush(groupId), ALBUM_GROUP_TIMEOUT_MS);
    } else {
      const timer = setTimeout(() => this.flush(groupId), ALBUM_GROUP_TIMEOUT_MS);
      this.groups.set(groupId, { messages: [job], timer });
    }
  }

  flush(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    clearTimeout(group.timer);
    this.groups.delete(groupId);

    const base = { ...group.messages[0] };
    base.mediaGroup = group.messages;

    this.logger.debug(
      { groupId, messageCount: group.messages.length },
      'Album flushed',
    );

    void this.onFlush(base);
  }

  clear(): void {
    for (const group of this.groups.values()) {
      clearTimeout(group.timer);
    }
    this.groups.clear();
  }
}
