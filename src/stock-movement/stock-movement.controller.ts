import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StockMovementService } from './stock-movement.service.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AdjustStockDTO } from './dto/adjust-stock.dto.js';
import { GetStockMovementListDTO } from './dto/get-stock-movement-list.dto.js';
import { StockMovementResEntity } from './entity/stock-movement-res.entity.js';
import { StockMovementListEntity } from './entity/stock-movement-list.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('stock-movement')
export class StockMovementController {
  constructor(private readonly stockMovementService: StockMovementService) {}

  @Get()
  async get(@Query() dto: GetStockMovementListDTO) {
    const result = await this.stockMovementService.getList(dto);

    return new StockMovementListEntity({
      success: true,
      data: result,
      meta: {
        total: result.length,
      },
    });
  }

  @Post('adjust')
  async adjust(@Body() dto: AdjustStockDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.stockMovementService.adjust(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new StockMovementResEntity({
      success: true,
      data: result,
    });
  }
}
