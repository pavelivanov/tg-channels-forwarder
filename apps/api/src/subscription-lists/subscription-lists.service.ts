import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BotNotAdminException } from '../bot/bot-not-admin.exception.ts';
import { BotService } from '../bot/bot.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import type { CreateSubscriptionListDto } from './dto/create-subscription-list.dto.ts';
import type { UpdateSubscriptionListDto } from './dto/update-subscription-list.dto.ts';

export interface SubscriptionListResponse {
  id: string;
  name: string;
  destinationChannelId: string;
  destinationUsername: string | null;
  isActive: boolean;
  createdAt: Date;
  sourceChannels: {
    id: string;
    telegramId: string;
    username: string | null;
    title: string;
  }[];
}

const SOURCE_CHANNEL_LIMIT = 30;

@Injectable()
export class SubscriptionListsService {
  private readonly logger = new Logger(SubscriptionListsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
  ) {}

  // --- Shared foundational methods (T005–T009) ---

  async countUserActiveLists(userId: string): Promise<number> {
    return this.prisma.subscriptionList.count({
      where: { userId, isActive: true },
    });
  }

  async countUserSourceChannels(
    userId: string,
    excludeListId?: string,
  ): Promise<number> {
    return this.prisma.subscriptionListChannel.count({
      where: {
        subscriptionList: {
          userId,
          isActive: true,
          ...(excludeListId ? { id: { not: excludeListId } } : {}),
        },
      },
    });
  }

  async validateSourceChannelIds(sourceChannelIds: string[]): Promise<string[]> {
    const uniqueIds = [...new Set(sourceChannelIds)];

    const activeChannels = await this.prisma.sourceChannel.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });

    const activeIdSet = new Set(activeChannels.map((ch) => ch.id));
    const invalidIds = uniqueIds.filter((id) => !activeIdSet.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid or inactive source channel IDs: ${invalidIds.join(', ')}`,
      );
    }

    return uniqueIds;
  }

  private formatListResponse(
    list: {
      id: string;
      name: string;
      destinationChannelId: bigint;
      destinationUsername: string | null;
      isActive: boolean;
      createdAt: Date;
      subscriptionListChannels: {
        sourceChannel: {
          id: string;
          telegramId: bigint;
          username: string | null;
          title: string;
        };
      }[];
    },
  ): SubscriptionListResponse {
    return {
      id: list.id,
      name: list.name,
      destinationChannelId: String(list.destinationChannelId),
      destinationUsername: list.destinationUsername,
      isActive: list.isActive,
      createdAt: list.createdAt,
      sourceChannels: list.subscriptionListChannels.map((slc) => ({
        id: slc.sourceChannel.id,
        telegramId: String(slc.sourceChannel.telegramId),
        username: slc.sourceChannel.username,
        title: slc.sourceChannel.title,
      })),
    };
  }

  private async findListByIdAndUser(id: string, userId: string) {
    return this.prisma.subscriptionList.findFirst({
      where: { id, userId, isActive: true },
    });
  }

  private async fetchListWithChannels(id: string) {
    return this.prisma.subscriptionList.findUniqueOrThrow({
      where: { id },
      include: {
        subscriptionListChannels: {
          include: { sourceChannel: true },
        },
      },
    });
  }

  // --- US1: Browse lists ---

  async findAllActive(userId: string): Promise<SubscriptionListResponse[]> {
    const lists = await this.prisma.subscriptionList.findMany({
      where: { userId, isActive: true },
      include: {
        subscriptionListChannels: {
          include: { sourceChannel: true },
        },
      },
    });

    return lists.map((list) => this.formatListResponse(list));
  }

  // --- US2: Create list ---

  async create(
    userId: string,
    dto: CreateSubscriptionListDto,
  ): Promise<SubscriptionListResponse> {
    // Normalize username (strip leading @)
    const username = dto.destinationUsername.replace(/^@/, '');

    // Resolve username to channel ID
    const resolved = await this.botService.resolveChannel(username);

    // Verify bot is admin in destination channel
    const isAdmin = await this.botService.verifyBotAdmin(resolved.id);
    if (!isAdmin) {
      throw new BotNotAdminException();
    }

    // Check list limit
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { maxLists: true },
    });

    const activeListCount = await this.countUserActiveLists(userId);
    if (activeListCount >= user.maxLists) {
      throw new ForbiddenException(
        `Subscription list limit reached (maximum: ${String(user.maxLists)})`,
      );
    }

    // Deduplicate and validate source channel IDs
    const uniqueIds = await this.validateSourceChannelIds(dto.sourceChannelIds);

    // Check source channel limit
    const currentChannelCount = await this.countUserSourceChannels(userId);
    if (currentChannelCount + uniqueIds.length > SOURCE_CHANNEL_LIMIT) {
      throw new ForbiddenException(
        `Source channel limit exceeded (maximum: ${String(SOURCE_CHANNEL_LIMIT)}, current: ${String(currentChannelCount)}, requested: ${String(uniqueIds.length)})`,
      );
    }

    // Create list with associations
    const created = await this.prisma.subscriptionList.create({
      data: {
        userId,
        name: dto.name,
        destinationChannelId: BigInt(resolved.id),
        destinationUsername: username,
        subscriptionListChannels: {
          create: uniqueIds.map((id) => ({ sourceChannelId: id })),
        },
      },
    });

    this.logger.log(
      { listId: created.id, userId },
      'Subscription list created',
    );

    const full = await this.fetchListWithChannels(created.id);
    return this.formatListResponse(full);
  }

  // --- US3: Update list ---

  async update(
    id: string,
    userId: string,
    dto: UpdateSubscriptionListDto,
  ): Promise<SubscriptionListResponse> {
    // Check at least one field present
    const hasName = dto.name !== undefined;
    const hasDestUsername = dto.destinationUsername !== undefined;
    const hasSourceChannels = dto.sourceChannelIds !== undefined;

    if (!hasName && !hasDestUsername && !hasSourceChannels) {
      throw new BadRequestException(
        'Request body must contain at least one updatable field',
      );
    }

    // Build scalar update data
    const updateData: {
      name?: string;
      destinationChannelId?: bigint;
      destinationUsername?: string;
    } = {};

    if (hasName) updateData.name = dto.name;

    // Resolve and verify new destination channel
    if (hasDestUsername) {
      const username = dto.destinationUsername!.replace(/^@/, '');
      const resolved = await this.botService.resolveChannel(username);
      const isAdmin = await this.botService.verifyBotAdmin(resolved.id);
      if (!isAdmin) {
        throw new BotNotAdminException();
      }
      updateData.destinationChannelId = BigInt(resolved.id);
      updateData.destinationUsername = username;
    }

    // Ownership + active check
    const existing = await this.findListByIdAndUser(id, userId);
    if (!existing) {
      throw new NotFoundException('Subscription list not found');
    }

    if (hasSourceChannels) {
      // Deduplicate and validate
      const uniqueIds = await this.validateSourceChannelIds(dto.sourceChannelIds!);

      // Check channel limit excluding current list
      const currentCount = await this.countUserSourceChannels(userId, id);
      if (currentCount + uniqueIds.length > SOURCE_CHANNEL_LIMIT) {
        throw new ForbiddenException(
          `Source channel limit exceeded (maximum: ${String(SOURCE_CHANNEL_LIMIT)}, current: ${String(currentCount)}, requested: ${String(uniqueIds.length)})`,
        );
      }

      // Transaction: update scalars + replace associations
      await this.prisma.$transaction(async (tx) => {
        await tx.subscriptionList.update({
          where: { id },
          data: updateData,
        });

        await tx.subscriptionListChannel.deleteMany({
          where: { subscriptionListId: id },
        });

        await tx.subscriptionListChannel.createMany({
          data: uniqueIds.map((sourceChannelId) => ({
            subscriptionListId: id,
            sourceChannelId,
          })),
        });
      });
    } else {
      // Only update scalars
      await this.prisma.subscriptionList.update({
        where: { id },
        data: updateData,
      });
    }

    this.logger.log(
      { listId: id, userId },
      'Subscription list updated',
    );

    const full = await this.fetchListWithChannels(id);
    return this.formatListResponse(full);
  }

  // --- US4: Delete list (soft delete) ---

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.findListByIdAndUser(id, userId);
    if (!existing) {
      throw new NotFoundException('Subscription list not found');
    }

    await this.prisma.subscriptionList.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(
      { listId: id, userId },
      'Subscription list soft-deleted',
    );
  }
}
