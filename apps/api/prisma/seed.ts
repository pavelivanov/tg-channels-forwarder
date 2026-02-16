import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL']!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { telegramId: 123456789n },
    update: {},
    create: {
      telegramId: 123456789n,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
    },
  });

  console.log(`Upserted user: ${user.firstName} (${user.telegramId})`);

  const channel1 = await prisma.sourceChannel.upsert({
    where: { telegramId: 1001000001n },
    update: {},
    create: {
      telegramId: 1001000001n,
      title: 'Tech News Channel',
      username: 'technews',
    },
  });

  const channel2 = await prisma.sourceChannel.upsert({
    where: { telegramId: 1001000002n },
    update: {},
    create: {
      telegramId: 1001000002n,
      title: 'Dev Updates',
      username: 'devupdates',
    },
  });

  console.log(`Upserted channels: ${channel1.title}, ${channel2.title}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
