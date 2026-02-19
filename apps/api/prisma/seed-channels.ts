import { fileURLToPath } from 'node:url';
import { TelegramClient, Api, sessions } from 'telegram';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const { StringSession } = sessions;

// --- Argument Parsing (T003) ---

export function parseArgs(argv: string[]): { usernames: string[]; join: boolean } {
  const args = argv.slice(2); // skip node + script path
  const join = args.includes('--join');
  const raw = args.filter((a) => a !== '--join');

  // Support both comma-separated and space-separated formats
  const split = raw.flatMap((a) => a.split(','));
  const stripped = split
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .map((u) => u.replace(/^@/, ''));

  // Deduplicate (case-insensitive, keep first occurrence)
  const seen = new Set<string>();
  const usernames: string[] = [];
  for (const u of stripped) {
    const lower = u.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      usernames.push(u);
    }
  }

  return { usernames, join };
}

// --- Environment Validation (T004) ---

export function validateEnv(): {
  apiId: number;
  apiHash: string;
  session: string;
  databaseUrl: string;
} {
  const required = [
    'TELEGRAM_API_ID',
    'TELEGRAM_API_HASH',
    'TELEGRAM_SESSION',
    'DATABASE_URL',
  ] as const;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Make sure your .env file contains all required variables.');
    process.exit(1);
  }

  return {
    apiId: Number(process.env['TELEGRAM_API_ID']),
    apiHash: process.env['TELEGRAM_API_HASH']!,
    session: process.env['TELEGRAM_SESSION']!,
    databaseUrl: process.env['DATABASE_URL']!,
  };
}

// --- Channel Resolution (T008) ---

interface ResolvedChannel {
  telegramId: number;
  title: string;
  username: string;
}

const DELAY_MIN_MS = 2000;
const DELAY_MAX_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveChannel(
  client: TelegramClient,
  username: string,
): Promise<ResolvedChannel> {
  try {
    const entity = await client.getEntity(username);

    if (!(entity instanceof Api.Channel)) {
      throw new Error(`@${username} is not a channel (got ${entity.className})`);
    }

    return {
      telegramId: Number(entity.id),
      title: entity.title ?? '',
      username,
    };
  } catch (error: unknown) {
    // FloodWaitError handling (T012): retry once after waiting
    if (error instanceof Error && 'seconds' in error && error.constructor.name === 'FloodWaitError') {
      const waitSeconds = (error as { seconds: number }).seconds;
      console.warn(`  Rate limited. Waiting ${String(waitSeconds)}s before retry...`);
      await sleep(waitSeconds * 1000);
      // Single retry
      const entity = await client.getEntity(username);
      if (!(entity instanceof Api.Channel)) {
        throw new Error(`@${username} is not a channel (got ${entity.className})`);
      }
      return {
        telegramId: Number(entity.id),
        title: entity.title ?? '',
        username,
      };
    }
    throw error;
  }
}

// --- Channel Upsert (T009) ---

export async function upsertChannel(
  prisma: PrismaClient,
  channel: ResolvedChannel,
): Promise<'created' | 'updated'> {
  const existing = await prisma.sourceChannel.findUnique({
    where: { username: channel.username },
  });

  await prisma.sourceChannel.upsert({
    where: { username: channel.username },
    create: {
      telegramId: BigInt(channel.telegramId),
      username: channel.username,
      title: channel.title,
      isActive: true,
    },
    update: {
      telegramId: BigInt(channel.telegramId),
      title: channel.title,
    },
  });

  return existing ? 'updated' : 'created';
}

// --- Join Channel (T014) ---

export async function joinChannel(
  client: TelegramClient,
  channelId: number,
  username: string,
): Promise<boolean> {
  try {
    await client.invoke(
      new Api.channels.JoinChannel({ channel: channelId }),
    );
    console.log(`  Joined @${username}`);
    return true;
  } catch (error: unknown) {
    // Already a participant — not an error
    if (error instanceof Error && error.message.includes('USER_ALREADY_PARTICIPANT')) {
      console.log(`  Already a member of @${username}`);
      return true;
    }
    console.warn(`  Failed to join @${username}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// --- Main (T003-T006, T010-T013, T015) ---

async function main(): Promise<void> {
  const { usernames, join } = parseArgs(process.argv);

  if (usernames.length === 0) {
    console.error('Usage: pnpm seed:channels [--join] @channel1,@channel2,...');
    console.error('       pnpm seed:channels [--join] @channel1 @channel2 ...');
    process.exit(1);
  }

  // Validate environment (T004)
  const env = validateEnv();

  console.log(`Resolving ${String(usernames.length)} channel(s)${join ? ' (will join)' : ''}...`);
  console.log(`Channels: ${usernames.map((u) => `@${u}`).join(', ')}\n`);

  // Initialize MTProto client (T005)
  const client = new TelegramClient(
    new StringSession(env.session),
    env.apiId,
    env.apiHash,
    { connectionRetries: 5 },
  );

  try {
    await client.connect();
    await client.getMe();
  } catch (error: unknown) {
    console.error('Failed to connect MTProto client. Check your TELEGRAM_SESSION.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Initialize Prisma (T006)
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  const prisma = new PrismaClient({ adapter });

  let seeded = 0;
  let skipped = 0;
  const skippedReasons: string[] = [];

  try {
    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i];
      console.log(`[${String(i + 1)}/${String(usernames.length)}] Resolving @${username}...`);

      try {
        // Resolve channel (T008, T010, T012)
        const resolved = await resolveChannel(client, username);
        console.log(`  Found: "${resolved.title}" (ID: ${String(resolved.telegramId)})`);

        // Optional join (T015)
        if (join) {
          await joinChannel(client, resolved.telegramId, username);
        }

        // Upsert to database (T009)
        const result = await upsertChannel(prisma, resolved);
        console.log(`  ${result === 'created' ? 'Added' : 'Updated'} in database\n`);
        seeded++;
      } catch (error: unknown) {
        // Per-channel error handling (T011)
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`  Skipped: ${msg}\n`);
        skipped++;
        skippedReasons.push(`@${username}: ${msg}`);
      }

      // Rate limit delay (T010) — skip delay after last channel
      if (i < usernames.length - 1) {
        const delay = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
        await sleep(delay);
      }
    }

    // Summary (T013)
    console.log('--- Summary ---');
    console.log(`Total:   ${String(usernames.length)}`);
    console.log(`Seeded:  ${String(seeded)}`);
    console.log(`Skipped: ${String(skipped)}`);
    if (skippedReasons.length > 0) {
      console.log('\nSkipped channels:');
      for (const reason of skippedReasons) {
        console.log(`  - ${reason}`);
      }
    }
  } finally {
    await client.disconnect();
    await prisma.$disconnect();
  }
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (e) => {
    console.error(e);
    process.exit(1);
  });
}
