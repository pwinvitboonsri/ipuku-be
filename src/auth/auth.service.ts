import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateDTO } from './DTO/create.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';
import { LoginDTO } from './DTO/login.dto.js';
import { JwtService } from '@nestjs/jwt';
import { UpdateStatusDTO } from './DTO/updateStatus.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { UpdateDTO } from './DTO/update.dto.js';
import { ChangePinDTO } from './DTO/change-pin.dto.js';
import { ResetPinDTO } from './DTO/reset-pin.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async get() {
    return await this.prisma.staff.findMany({
      where: {
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async me(staffId: string) {
    const me = await this.prisma.staff.findFirstOrThrow({
      where: {
        id: staffId,
      },
    });

    return me;
  }

  async login(dto: LoginDTO) {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: {
        id: dto.id,
        is_active: true
      },
    });

    const pinMatch = await bcrypt.compare(dto.pin, staff.pin_hash);

    if (!pinMatch) throw new UnauthorizedException('Invalid pin');

    const payload = {
      sub: staff.id,
      name: staff.name,
      isActive: staff.is_active,
      role: staff.role,
    };
    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        is_active: staff.is_active,
        create_at: staff.create_at,
        update_at: staff.update_at,
      },
    };
  }

  async create(dto: CreateDTO) {
    const hashedPin = await bcrypt.hash(dto.pin, 10);

    return this.prisma.staff.create({
      data: {
        name: dto.name,
        pin_hash: hashedPin,
        role: dto.role,
        is_active: dto.isActive,
      },
    });
  }

  async update(dto: UpdateDTO, currentUserId: string) {
    const staff = await this.prisma.staff.findFirstOrThrow({
      where: {
        id: dto.id,
      },
    });

    const currentUser = await this.prisma.staff.findUniqueOrThrow({
      where: {
        id: currentUserId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    // staff may only rename themselves
    if (currentUser.role === Role.STAFF) {
      if (currentUser.id !== staff.id) {
        throw new ForbiddenException('Staff can only edit themselves');
      }

      if (dto.role !== undefined) {
        throw new ForbiddenException('Staff cannot change roles');
      }
    }

    if (
      currentUser.role === Role.OWNER &&
      staff.role === Role.OWNER &&
      currentUser.id !== staff.id
    ) {
      throw new ForbiddenException('Cannot edit another owner');
    }

    // never leave the shop without an active owner
    if (
      staff.role === Role.OWNER &&
      staff.is_active &&
      dto.role !== undefined &&
      dto.role !== Role.OWNER
    ) {
      const activeOwnerCount = await this.prisma.staff.count({
        where: {
          role: Role.OWNER,
          is_active: true,
        },
      });

      if (activeOwnerCount <= 1) {
        throw new BadRequestException('Cannot demote the last active owner');
      }
    }

    const updateStaff = await this.prisma.staff.update({
      where: {
        id: dto.id,
      },
      data: {
        name: dto.name,
        role: dto.role,
      },
    });

    return updateStaff;
  }

  async updateStatus(dto: UpdateStatusDTO) {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: {
        id: dto.id,
      },
    });

    if (staff.role === Role.OWNER && staff.is_active) {
      const activeOwnerCount = await this.prisma.staff.count({
        where: {
          role: Role.OWNER,
          is_active: true,
        },
      });

      if (activeOwnerCount <= 1) {
        throw new BadRequestException(
          'Cannot deactivate the last active owner',
        );
      }
    }

    return await this.prisma.staff.update({
      where: { id: dto.id },
      data: { is_active: !staff.is_active },
      select: {
        id: true,
        name: true,
        is_active: true,
      },
    });
  }

  async changePin(dto: ChangePinDTO, currentUserId: string) {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: {
        id: currentUserId,
      },
      select: {
        id: true,
        pin_hash: true,
      },
    });

    const pinMatch = await bcrypt.compare(dto.old_pin, staff.pin_hash);

    if (!pinMatch) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const newPinHash = await bcrypt.hash(dto.new_pin, 10);

    return this.prisma.staff.update({
      where: {
        id: currentUserId,
      },
      data: {
        pin_hash: newPinHash,
      },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
        update_at: true,
        create_at: true,
      },
    });
  }

  async resetPin(dto: ResetPinDTO) {
    await this.prisma.staff.findUniqueOrThrow({
      where: {
        id: dto.id,
        is_active: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    const newPinHash = await bcrypt.hash(dto.new_pin, 10);

    return this.prisma.staff.update({
      where: {
        id: dto.id,
      },
      data: {
        pin_hash: newPinHash,
      },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
        update_at: true,
        create_at: true,
      },
    });
  }
}
