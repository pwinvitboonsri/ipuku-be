import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator"

export class UpdateCategoryDTO {
    @IsString()
    @IsOptional()
    name?: string

    @IsNumber()
    @IsOptional()
    sort_order?: number
}