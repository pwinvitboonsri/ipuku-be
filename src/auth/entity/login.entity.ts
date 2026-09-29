import { StaffEntity } from './staff.entity.js';

export class LoginEntity {
  staff: StaffEntity;
  access_token: string;

  constructor(partial: Partial<LoginEntity>) {
    Object.assign(this, partial);
  }
}
