import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class UpdateSubscriptionListDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{3,}$/, {
    message: 'destinationUsername must be a valid Telegram channel username (e.g. @mychannel)',
  })
  destinationUsername?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  sourceChannelIds?: string[];
}
