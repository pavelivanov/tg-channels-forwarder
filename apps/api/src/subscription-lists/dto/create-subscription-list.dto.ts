import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSubscriptionListDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  destinationChannelId!: number;

  @IsOptional()
  @IsString()
  destinationUsername?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  sourceChannelIds!: string[];
}
