import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MenuService } from '../menu/menu.service.js';
import { mapGrabMenu } from './function/map-grab-menu.function.js';

// The menu Grab pulls: the same active categories/products/options as the counter
@Injectable()
export class GrabMenuService {
  constructor(
    private readonly menuService: MenuService,
    private readonly config: ConfigService,
  ) {}

  async getMenu(partnerMerchantId?: string) {
    const categories = await this.menuService.getMenu();

    return mapGrabMenu(
      categories,
      this.config.get<string>('grab.merchantId') ?? '',
      partnerMerchantId ?? 'ipuku',
    );
  }
}
