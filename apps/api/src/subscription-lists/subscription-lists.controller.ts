import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { SubscriptionListsService } from './subscription-lists.service.ts';
import { CreateSubscriptionListDto } from './dto/create-subscription-list.dto.ts';
import { UpdateSubscriptionListDto } from './dto/update-subscription-list.dto.ts';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('subscription-lists')
export class SubscriptionListsController {
  constructor(private readonly service: SubscriptionListsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.service.findAllActive(req.user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSubscriptionListDto,
  ) {
    return this.service.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionListDto,
  ) {
    return this.service.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(id, req.user.sub);
  }
}
