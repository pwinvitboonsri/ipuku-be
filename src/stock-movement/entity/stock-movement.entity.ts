import { StockMovementReason } from '../../generated/prisma/enums.js';

export class StockMovementEntity {
  id: string;
  change_quantity: number;
  reason: StockMovementReason;
  note: string | null;
  ingredient_id: string;
  order_id: string | null;
  update_at: Date;
  create_at: Date;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
  };

  constructor(partial: Partial<StockMovementEntity>) {
    Object.assign(this, partial);
  }
}
