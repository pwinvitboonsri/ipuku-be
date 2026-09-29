import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductModifierGroupService } from '../service/product-modifier-group.service.js';
import { JwtAuthGuard } from '../../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/guard/roles.guard.js';
import { Roles } from '../../common/auth/decorator/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import { AttachModifierGroupDTO } from '../dto/attach-modifier-group.dto.js';
import { UpdateProductModifierGroupDTO } from '../dto/update-product-modifier-group.dto.js';
import { ProductModifierGroupKeyDTO } from '../dto/product-modifier-group-key.dto.js';
import { GetByProductDTO } from '../dto/get-by-product.dto.js';
import { ProductModifierGroupResEntity } from '../entity/product-modifier-group-res.entity.js';
import { ProductModifierGroupListEntity } from '../entity/product-modifier-group-list.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-modifier-group')
export class ProductModifierGroupController {
  constructor(
    private readonly productModifierGroupService: ProductModifierGroupService,
  ) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get('product/:productId')
  async getByProduct(@Param() dto: GetByProductDTO) {
    const result = await this.productModifierGroupService.getByProduct(dto);

    return new ProductModifierGroupListEntity({
      success: true,
      data: result,
      meta: {
        total: result.length,
      },
    });
  }

  @Roles(Role.OWNER)
  @Post('attach')
  async attach(@Body() dto: AttachModifierGroupDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.productModifierGroupService.attach(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ProductModifierGroupResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('update')
  async update(@Body() dto: UpdateProductModifierGroupDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.productModifierGroupService.update(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ProductModifierGroupResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('detach')
  async detach(@Body() dto: ProductModifierGroupKeyDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.productModifierGroupService.detach(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ProductModifierGroupResEntity({
      success: true,
      data: result,
    });
  }
}
