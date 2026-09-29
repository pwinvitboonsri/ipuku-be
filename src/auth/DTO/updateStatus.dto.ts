import { IsNotEmpty, IsString } from "class-validator";

export class UpdateStatusDTO {
    @IsNotEmpty()
    @IsString()
    id: string
}