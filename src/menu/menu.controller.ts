import { Controller, Get, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { MenuResEntity } from './entity/menu.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.STAFF)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  async get() {
    const result = await this.menuService.getMenu();

    return new MenuResEntity({
      success: true,
      data: result,
      meta: {
        categories: result.length,
        products: result.reduce((sum, c) => sum + c.product.length, 0),
      },
    });
  }
}
