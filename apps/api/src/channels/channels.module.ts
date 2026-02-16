import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller.ts';
import { ChannelsService } from './channels.service.ts';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
