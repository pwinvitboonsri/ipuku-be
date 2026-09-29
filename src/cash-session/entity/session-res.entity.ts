import { SessionEntity } from './session.entity.js';

export class SessionResEntity {
  success: boolean;
  data: SessionEntity | null

  constructor(partial: Partial<SessionResEntity>) {
    Object.assign(this, partial);
  }
}
