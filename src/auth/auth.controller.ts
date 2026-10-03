import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CreateDTO } from './DTO/create.dto.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { LoginEntity } from './entity/login.entity.js';
import { LoginDTO } from './DTO/login.dto.js';
import { GetUserEntity, UserPickEntity } from './entity/get.entity.js';
import { HmacAuthGuard } from '../common/HMAC/guard/hmac-auth.guard.js';
import { UpdateStatusDTO } from './DTO/updateStatus.dto.js';
import { StaffEntity } from './entity/staff.entity.js';
import { UpdateDTO } from './DTO/update.dto.js';
import { ChangePinDTO } from './DTO/change-pin.dto.js';
import { ResetPinDTO } from './DTO/reset-pin.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(HmacAuthGuard)
  @Get()
  async get() {
    const userList = await this.authService.get();
    const result = userList.map((staff) => new UserPickEntity(staff));

    return new GetUserEntity({ user: result, total: result.length });
  }

  // Back office staff list: includes role and inactive staff (GET /auth is the login grid)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Get('staff')
  async getAll() {
    const staffList = await this.authService.getAll();
    const result = staffList.map((staff) => new StaffEntity(staff));

    return { staff: result, total: result.length };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const staffId = req.user.userId;
    const staff = await this.authService.me(staffId);

    return new StaffEntity(staff);
  }

  // strict limit slows PIN guessing; read per request so .env is loaded
  @Throttle({
    default: {
      limit: () => Number(process.env.LOGIN_THROTTLE_LIMIT) || 10,
      ttl: 60000,
    },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDTO) {
    const user = await this.authService.login(dto);

    return new LoginEntity(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post('create')
  async create(@Body() dto: CreateDTO) {
    const user = await this.authService.create(dto);

    return new StaffEntity(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async update(@Body() dto: UpdateDTO, @Req() req: any) {
    const currentUserId = req.user.userId;
    const updatedStaff = await this.authService.update(dto, currentUserId);

    return new StaffEntity(updatedStaff);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post('update/status')
  async updateStatus(@Body() dto: UpdateStatusDTO) {
    const updatedStaff = await this.authService.updateStatus(dto);

    return new StaffEntity(updatedStaff);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pin/change')
  async changePin(@Body() dto: ChangePinDTO, @Req() req: any) {
    const staffId = req.user.userId;
    const updatedStaff = await this.authService.changePin(dto, staffId);

    return new StaffEntity(updatedStaff);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post('pin/reset')
  async restPin(@Body() dto: ResetPinDTO) {
    const updatedStaff = await this.authService.resetPin(dto);

    return new StaffEntity(updatedStaff);
  }
}
