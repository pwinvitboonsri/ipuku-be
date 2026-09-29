import { IsNotEmpty, IsNumber, IsUUID } from "class-validator";

export class OpenSessionDTO {
    @IsNotEmpty()
    @IsNumber()
    opening_float_satang: number
}