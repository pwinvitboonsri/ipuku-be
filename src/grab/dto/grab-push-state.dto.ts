import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// GrabFood "Push Order State" webhook body (DRIVER_ALLOCATED, DRIVER_ARRIVED,
// COLLECTED, DELIVERED, FAILED, CANCELLED). ⚠ Check against Grab's docs.
export class GrabPushStateDTO {
  @IsNotEmpty()
  @IsString()
  orderID: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  merchantID?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
