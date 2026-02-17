import { BadRequestException } from '@nestjs/common';

export class BotNotAdminException extends BadRequestException {
  constructor() {
    super({
      statusCode: 400,
      error: 'Bad Request',
      message:
        'Please add the bot as an administrator to your destination channel before creating a subscription list.',
      errorCode: 'DESTINATION_BOT_NOT_ADMIN',
    });
  }
}
