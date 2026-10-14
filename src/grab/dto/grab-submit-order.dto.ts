import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

// GrabFood "Submit Order" webhook body. Only the fields we use are declared;
// everything else Grab sends is stripped (see parseGrabBody), never rejected.
// Field names follow Grab's partner docs. Money is in minor units (satang).
// ⚠ Check against developer.grab.com before going live.

export class GrabModifierDTO {
  // our modifier_option.id (we serve it as the modifier id in the menu)
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsInt()
  price?: number;
}

export class GrabOrderItemDTO {
  // our product.id (we serve it as the item id in the menu)
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsInt()
  price?: number;

  // customer note for this item
  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrabModifierDTO)
  modifiers?: GrabModifierDTO[];
}

export class GrabOrderPriceDTO {
  @IsInt()
  subtotal: number;

  @IsOptional()
  @IsInt()
  eaterPayment?: number;
}

export class GrabFeatureFlagsDTO {
  // AUTO: Grab already accepted it for the merchant; MANUAL: we must accept/reject
  @IsOptional()
  @IsString()
  orderAcceptedType?: string;

  @IsOptional()
  @IsString()
  orderType?: string;
}

export class GrabSubmitOrderDTO {
  @IsNotEmpty()
  @IsString()
  orderID: string;

  // the number the rider and customer see, e.g. "GF-123"
  @IsNotEmpty()
  @IsString()
  shortOrderNumber: string;

  @IsNotEmpty()
  @IsString()
  merchantID: string;

  @IsOptional()
  @IsString()
  partnerMerchantID?: string;

  @IsOptional()
  @IsString()
  orderState?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrabOrderItemDTO)
  items: GrabOrderItemDTO[];

  @ValidateNested()
  @Type(() => GrabOrderPriceDTO)
  price: GrabOrderPriceDTO;

  @IsOptional()
  @ValidateNested()
  @Type(() => GrabFeatureFlagsDTO)
  featureFlags?: GrabFeatureFlagsDTO;
}
