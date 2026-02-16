import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.ts';
import { Public } from './public.decorator.ts';
import type { AuthResponse } from './types.ts';
import { ValidateInitDataDto } from './types.ts';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('validate')
  async validate(@Body() dto: ValidateInitDataDto): Promise<AuthResponse> {
    return this.authService.authenticate(dto.initData);
  }
}
