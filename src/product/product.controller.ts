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
import { ProductService } from './product.service.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  canSeeInactive,
  IncludeInactiveDTO,
} from '../common/dto/include-inactive.dto.js';
import { CreateProductDTO } from './dto/create-product.dto.js';
import { ProductResEntity } from './entity/product-res.entity.js';
import { ProductResListEntity } from './entity/product-res-list.entity.js';
import { UpdateProductDTO } from './dto/update-product.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get('list')
  async getProductList(@Query() query: IncludeInactiveDTO, @Req() req: any) {
    const productList = await this.productService.getProductList(
      canSeeInactive(query, req.user),
    );

    return new ProductResListEntity({
      success: true,
      data: productList,
      meta: {
        total: productList.length,
      },
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Post('create')
  async createProduct(@Body() dto: CreateProductDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const product = await this.productService.createProduct(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ProductResEntity({
      success: true,
      data: product,
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Get(':id')
  async getProduct(@Param('id') id: string) {
    const product = await this.productService.getProduct(id);

    return new ProductResEntity({
      success: true,
      data: product,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update')
  async updateProduct(
    @Body() dto: UpdateProductDTO,
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const product = await this.productService.updateProduct(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ProductResEntity({
      success: true,
      data: product,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update-status')
  async updateProductStatus(@Req() req: any, @Param('id') id: string) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const product = await this.productService.updateProductStatus(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ProductResEntity({
      success: true,
      data: product,
    });
  }
}
