-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "photoUrl" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "maxLists" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceChannel" (
    "id" UUID NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionList" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "destinationChannelId" BIGINT NOT NULL,
    "destinationUsername" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionListChannel" (
    "id" UUID NOT NULL,
    "subscriptionListId" UUID NOT NULL,
    "sourceChannelId" UUID NOT NULL,

    CONSTRAINT "SubscriptionListChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceChannel_telegramId_key" ON "SourceChannel"("telegramId");

-- CreateIndex
CREATE INDEX "SubscriptionList_userId_idx" ON "SubscriptionList"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionListChannel_subscriptionListId_sourceChannelId_key" ON "SubscriptionListChannel"("subscriptionListId", "sourceChannelId");

-- AddForeignKey
ALTER TABLE "SubscriptionList" ADD CONSTRAINT "SubscriptionList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionListChannel" ADD CONSTRAINT "SubscriptionListChannel_subscriptionListId_fkey" FOREIGN KEY ("subscriptionListId") REFERENCES "SubscriptionList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionListChannel" ADD CONSTRAINT "SubscriptionListChannel_sourceChannelId_fkey" FOREIGN KEY ("sourceChannelId") REFERENCES "SourceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
