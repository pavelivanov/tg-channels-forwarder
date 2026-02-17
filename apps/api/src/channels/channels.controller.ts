import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ChannelsService } from './channels.service.ts';
import { CreateChannelDto } from './dto/create-channel.dto.ts';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  findAll() {
    return this.channelsService.findAllActive();
  }

  @Post()
  async create(@Body() dto: CreateChannelDto, @Res() res: HttpResponse) {
    const { channel, created } = await this.channelsService.findOrCreate(
      dto.username,
    );
    res.status(created ? 201 : 200).json(channel);
  }
}
