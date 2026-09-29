import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service.js';
import { PaymentService } from './payment.service.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateOrderDTO } from './dto/create-order.dto.js';
import { VoidOrderDTO } from './dto/void-order.dto.js';
import { PayOrderDTO } from './dto/pay-order.dto.js';
import { RefundOrderDTO } from './dto/refund-order.dto.js';
import { GetOrderListDTO } from './dto/get-order-list.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { OrderResEntity } from './entity/order-res.entity.js';
import { OrderListEntity } from './entity/order-list.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.STAFF)
@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get()
  async get(@Query() dto: GetOrderListDTO) {
    const result = await this.orderService.getList(dto);

    return new OrderListEntity({
      success: true,
      data: result,
      meta: {
        total: result.length,
      },
    });
  }

  @Get(':id')
  async getById(@Param() dto: GetByIdDTO) {
    const result = await this.orderService.getById(dto);

    return new OrderResEntity({
      success: true,
      data: result,
    });
  }

  @Post('create')
  async create(@Body() dto: CreateOrderDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.orderService.create(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new OrderResEntity({
      success: true,
      data: result,
    });
  }

  @Post(':id/void')
  async void(
    @Body() dto: VoidOrderDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.orderService.void(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new OrderResEntity({
      success: true,
      data: result,
    });
  }

  @Post(':id/pay')
  async pay(
    @Body() dto: PayOrderDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.paymentService.pay(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new OrderResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/refund')
  async refund(
    @Body() dto: RefundOrderDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.paymentService.refund(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new OrderResEntity({
      success: true,
      data: result,
    });
  }
}
