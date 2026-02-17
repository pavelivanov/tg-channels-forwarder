import { Module } from '@nestjs/common';
import { SubscriptionListsController } from './subscription-lists.controller.ts';
import { SubscriptionListsService } from './subscription-lists.service.ts';

@Module({
  controllers: [SubscriptionListsController],
  providers: [SubscriptionListsService],
})
export class SubscriptionListsModule {}
