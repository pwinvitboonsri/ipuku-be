export class UserPickEntity {
  id: string;
  name: string;
  is_active: boolean;

  constructor(partial: Partial<UserPickEntity>) {
    this.id = partial.id!;
    this.name = partial.name!;
  }
}

export class GetUserEntity {
  user: UserPickEntity[];
  total: number;

  constructor(partial: Partial<GetUserEntity>) {
    Object.assign(this, partial);
  }
}
