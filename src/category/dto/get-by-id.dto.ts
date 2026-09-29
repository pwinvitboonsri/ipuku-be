import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class GetByIdDTO {
    @IsUUID()
    id: string
}