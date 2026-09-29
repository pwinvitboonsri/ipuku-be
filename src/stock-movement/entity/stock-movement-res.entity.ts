import { StockMovementEntity } from './stock-movement.entity.js';

export class StockMovementResEntity {
  success: boolean;
  data: StockMovementEntity;

  constructor(partial: Partial<StockMovementResEntity>) {
    Object.assign(this, partial);
  }
}
