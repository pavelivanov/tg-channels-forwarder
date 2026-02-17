import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller.ts';
import { ChannelsService } from './channels.service.ts';
import { channelOpsQueueProvider } from './channel-ops.provider.ts';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, channelOpsQueueProvider],
})
export class ChannelsModule {}
