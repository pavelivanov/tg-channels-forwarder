import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.ts';
import type {
  AuthResponse,
  UserProfile,
  WebAppUser,
} from './types.ts';

const INIT_DATA_EXPIRY_SECONDS = 300; // 5 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  validateInitData(initDataRaw: string): WebAppUser {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');

    if (!hash) {
      this.logger.warn('initData missing hash parameter');
      throw new UnauthorizedException('Invalid initData');
    }

    // Build data-check-string: all pairs except hash, sorted by key, joined by \n
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Derive secret: HMAC-SHA256(key="WebAppData", data=botToken)
    const botToken = this.config.get<string>('BOT_TOKEN')!;
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Compute hash: HMAC-SHA256(key=secretKey, data=dataCheckString)
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Constant-time comparison
    const hashBuffer = Buffer.from(hash, 'utf-8');
    const computedBuffer = Buffer.from(computedHash, 'utf-8');

    if (
      hashBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(hashBuffer, computedBuffer)
    ) {
      this.logger.warn('initData HMAC validation failed');
      throw new UnauthorizedException('Invalid initData');
    }

    // Verify auth_date is within 5 minutes
    const authDate = Number(params.get('auth_date'));
    if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_EXPIRY_SECONDS) {
      this.logger.warn(
        { authDate, age: Math.floor(Date.now() / 1000 - authDate) },
        'initData auth_date expired',
      );
      throw new UnauthorizedException('Invalid initData');
    }

    // Parse and return user object
    const userRaw = params.get('user');
    if (!userRaw) {
      this.logger.warn('initData missing user object');
      throw new UnauthorizedException('Invalid initData');
    }

    return JSON.parse(userRaw) as WebAppUser;
  }

  async upsertUser(webAppUser: WebAppUser) {
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(webAppUser.id) },
      create: {
        telegramId: BigInt(webAppUser.id),
        firstName: webAppUser.first_name,
        lastName: webAppUser.last_name ?? null,
        username: webAppUser.username ?? null,
        photoUrl: webAppUser.photo_url ?? null,
        isPremium: webAppUser.is_premium ?? false,
      },
      update: {
        firstName: webAppUser.first_name,
        lastName: webAppUser.last_name ?? null,
        username: webAppUser.username ?? null,
        photoUrl: webAppUser.photo_url ?? null,
        isPremium: webAppUser.is_premium ?? false,
      },
    });
  }

  async authenticate(initDataRaw: string): Promise<AuthResponse> {
    const webAppUser = this.validateInitData(initDataRaw);
    const user = await this.upsertUser(webAppUser);

    const payload = {
      sub: user.id,
      telegramId: String(user.telegramId),
    };

    const token = await this.jwtService.signAsync(payload);

    const userProfile: UserProfile = {
      id: user.id,
      telegramId: String(user.telegramId),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      isPremium: user.isPremium,
    };

    return { token, user: userProfile };
  }
}
