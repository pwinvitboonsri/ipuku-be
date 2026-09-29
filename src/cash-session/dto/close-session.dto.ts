import { IsNotEmpty, IsNumber, IsUUID } from "class-validator";

export class CloseSessionDTO {
    @IsNotEmpty()
    @IsUUID()
    id: string

    @IsNotEmpty()
    @IsNumber()
    counted_cash_satang: number
}