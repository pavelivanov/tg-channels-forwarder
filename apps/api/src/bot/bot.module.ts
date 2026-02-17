import { Global, Module } from '@nestjs/common';
import { BotService } from './bot.service.ts';

@Global()
@Module({
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
