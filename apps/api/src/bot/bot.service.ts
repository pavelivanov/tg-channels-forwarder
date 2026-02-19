import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, GrammyError } from 'grammy';
import { HEALTH_CHECK_TIMEOUT_MS } from '@aggregator/shared';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private readonly api: Api;
  private botUserId!: number;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('BOT_TOKEN')!;
    this.api = new Api(token);
  }

  async onModuleInit(): Promise<void> {
    try {
      const me = await this.api.getMe();
      this.botUserId = me.id;
      this.logger.log(`Bot initialized: @${me.username} (${me.id})`);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : error },
        'Failed to initialize bot — check BOT_TOKEN',
      );
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await Promise.race([
        this.api.getMe(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Bot health check timeout')),
            HEALTH_CHECK_TIMEOUT_MS,
          ),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async resolveChannel(username: string): Promise<{ id: number; title: string }> {
    try {
      const chat = await this.api.getChat(`@${username}`);
      const title = 'title' in chat ? chat.title ?? '' : '';
      this.logger.log(`Channel resolved: @${username} → ${String(chat.id)} (${title})`);
      return { id: chat.id, title };
    } catch (error: unknown) {
      if (error instanceof GrammyError) {
        this.logger.warn(`Channel resolution failed for @${username}: ${error.message}`);
        throw new BadRequestException(
          'Channel not found or bot has no access. Make sure the channel exists and the bot is a member.',
        );
      }

      this.logger.error(
        { username, error },
        'Unexpected error resolving channel',
      );
      throw new ServiceUnavailableException(
        'Unable to resolve channel. Please try again later.',
      );
    }
  }

  async verifyBotAdmin(channelId: number): Promise<boolean> {
    try {
      const member = await this.api.getChatMember(
        channelId,
        this.botUserId,
        // Node.js AbortSignal is structurally compatible but grammY uses abort-controller types
        AbortSignal.timeout(10_000) as never,
      );

      return member.status === 'administrator' || member.status === 'creator';
    } catch (error: unknown) {
      if (error instanceof GrammyError) {
        this.logger.warn(
          { channelId },
          `Grammy error verifying bot admin: ${error.message}`,
        );
        return false;
      }

      this.logger.error(
        { channelId, error },
        'Failed to verify bot admin status',
      );
      throw new ServiceUnavailableException(
        'Unable to verify bot admin status. Please try again later.',
      );
    }
  }
}
