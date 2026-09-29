import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator"

export class CreateProductDTO {
    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsNumber()
    price_satang: number

    @IsNotEmpty()
    @IsBoolean()
    is_active: boolean

    @IsOptional()
    @IsString()
    image_url?: string

    @IsNotEmpty()
    @IsUUID()
    category_id: string
}