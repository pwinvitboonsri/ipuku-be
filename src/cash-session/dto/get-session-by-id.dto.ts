import { IsNotEmpty, IsUUID } from "class-validator";

export class GetSessionById {
    @IsNotEmpty()
    @IsUUID()
    id: string
}