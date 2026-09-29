import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateModifierGroupDTO {
  @IsNotEmpty()
  @IsString()
  name: string;

  // group is required when min_select >= 1
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  min_select: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  max_select: number;

  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;
}
