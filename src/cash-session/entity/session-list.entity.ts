import { SessionEntity } from './session.entity.js';

export class SessionListEntity {
  success: boolean;

  data: SessionEntity[];

  meta: {
    total: number;
    filter: {
      before: Date;
      after?: Date;
      is_opening?: boolean;
      opened_by_staff_id?: string;
      close_by_staff_id?: string;
    };
  };

  constructor(partial: Partial<SessionListEntity>) {
    Object.assign(this, partial);
  }
}
