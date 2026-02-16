/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `SourceChannel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SourceChannel_username_key" ON "SourceChannel"("username");
