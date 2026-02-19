import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateSubscriptionListDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{3,}$/, {
    message: 'destinationUsername must be a valid Telegram channel username (e.g. @mychannel)',
  })
  destinationUsername!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  sourceChannelIds!: string[];
}
