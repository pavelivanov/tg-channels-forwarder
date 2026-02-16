import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateChannelDto {
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]{5,32}$/, {
    message: 'Username must be 5-32 characters, alphanumeric and underscores only',
  })
  username!: string;
}
