import {
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, GrammyError } from 'grammy';

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
    const me = await this.api.getMe();
    this.botUserId = me.id;
    this.logger.log(`Bot initialized: @${me.username} (${me.id})`);
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
        this.logger.warn({ channelId }, `Grammy error verifying bot admin: ${error.message}`);
        return false;
      }

      this.logger.error({ channelId, error }, 'Failed to verify bot admin status');
      throw new ServiceUnavailableException(
        'Unable to verify bot admin status. Please try again later.',
      );
    }
  }
}
