import { StockMovementEntity } from './stock-movement.entity.js';

export class StockMovementListEntity {
  success: boolean;
  data: StockMovementEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<StockMovementListEntity>) {
    Object.assign(this, partial);
  }
}
