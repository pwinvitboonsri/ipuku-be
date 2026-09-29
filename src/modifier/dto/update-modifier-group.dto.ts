import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateModifierGroupDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_select?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_select?: number;
}
