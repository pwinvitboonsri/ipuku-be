import { Exclude } from 'class-transformer';
import { Role } from '../../generated/prisma/enums.js';

export class StaffEntity {
  id: string;
  name: string;
  role: Role;

  @Exclude()
  pin_hash?: string

  is_active: boolean;
  update_at: Date;
  create_at: Date;

  constructor(partial: Partial<StaffEntity>) {
    Object.assign(this, partial);
  }
}
