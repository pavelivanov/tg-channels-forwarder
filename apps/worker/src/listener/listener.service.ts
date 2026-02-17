import { TelegramClient, Api, sessions } from 'telegram';
import { NewMessage, type NewMessageEvent } from 'telegram/events/index.js';
import type { PrismaClient } from '../generated/prisma/client.ts';

const { StringSession } = sessions;
import type pino from 'pino';
import type { QueueProducer } from '../queue/queue-producer.ts';
import { extractForwardJob } from './message-extractor.ts';

export interface ListenerConfig {
  apiId: number;
  apiHash: string;
  sessionString: string;
}

export class ListenerService {
  private client!: TelegramClient;
  private activeChannelIds = new Set<number>();
  private readonly recentMessageIds = new Set<string>();
  private readonly logger: pino.Logger;
  private injectedClient?: TelegramClient;
  private albumGrouper?: { addMessage: (job: import('@aggregator/shared').ForwardJob) => void; clear: () => void };

  constructor(
    private readonly config: ListenerConfig,
    logger: pino.Logger,
    private readonly queueProducer: QueueProducer,
    private readonly prisma: PrismaClient,
    injectedClient?: TelegramClient,
  ) {
    this.logger = logger.child({ service: 'ListenerService' });
    this.injectedClient = injectedClient;
  }

  async start(): Promise<void> {
    if (this.injectedClient) {
      this.client = this.injectedClient;
    } else {
      this.client = new TelegramClient(
        new StringSession(this.config.sessionString),
        this.config.apiId,
        this.config.apiHash,
        {
          connectionRetries: 10,
          retryDelay: 1000,
          autoReconnect: true,
          floodSleepThreshold: 120,
        },
      );
    }

    await this.client.connect();
    await this.client.getMe();

    await this.loadActiveChannels();

    const channelIds = [...this.activeChannelIds];

    this.client.addEventHandler(
      (event: NewMessageEvent) => this.handleNewMessage(event),
      new NewMessage({ chats: channelIds, incoming: true }),
    );

    this.logger.info(
      { channelCount: this.activeChannelIds.size },
      'Listener started',
    );
  }

  async stop(): Promise<void> {
    if (this.albumGrouper) {
      this.albumGrouper.clear();
    }
    if (this.client) {
      await this.client.disconnect();
    }
    this.logger.info('Listener stopped');
  }

  getClient(): TelegramClient {
    return this.client;
  }

  setAlbumGrouper(grouper: { addMessage: (job: import('@aggregator/shared').ForwardJob) => void; clear: () => void }): void {
    this.albumGrouper = grouper;
  }

  onDisconnect(): void {
    this.logger.warn('userbot_disconnected');
  }

  async onReconnect(): Promise<void> {
    this.logger.info('userbot_reconnected');
    await this.loadActiveChannels();
  }

  async loadActiveChannels(): Promise<void> {
    const channels = await this.prisma.sourceChannel.findMany({
      where: { isActive: true },
    });
    this.activeChannelIds.clear();
    for (const ch of channels) {
      this.activeChannelIds.add(Number(ch.telegramId));
    }
    this.logger.info(
      { channelCount: this.activeChannelIds.size },
      'Loaded active channels',
    );
  }

  private async handleNewMessage(event: NewMessageEvent): Promise<void> {
    const message = event.message;
    const channelId = Number((message.peerId as Api.PeerChannel).channelId);

    if (!this.activeChannelIds.has(channelId)) {
      return;
    }

    // Skip service messages (no text and no media)
    if (!message.message && !message.media) {
      return;
    }

    // Deduplicate by source channel + message ID
    const dedupKey = `${String(channelId)}:${String(message.id)}`;
    if (this.recentMessageIds.has(dedupKey)) {
      return;
    }
    this.recentMessageIds.add(dedupKey);
    // Bound memory: keep last 10000 entries
    if (this.recentMessageIds.size > 10000) {
      const first = this.recentMessageIds.values().next().value;
      if (first !== undefined) {
        this.recentMessageIds.delete(first);
      }
    }

    this.logger.debug(
      { channelId, messageId: message.id },
      'message_received',
    );

    const job = extractForwardJob(message);

    if (job.mediaGroupId && this.albumGrouper) {
      this.albumGrouper.addMessage(job);
      return;
    }

    await this.queueProducer.enqueueMessage(job);
  }
}
