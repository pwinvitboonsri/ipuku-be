import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { ModifierGroupController } from './controller/modifier-group.controller.js';
import { ModifierGroupService } from './service/modifier-group.service.js';
import { ModifierOptionController } from './controller/modifier-option.controller.js';
import { ModifierOptionService } from './service/modifier-option.service.js';
import { ProductModifierGroupController } from './controller/product-modifier-group.controller.js';
import { ProductModifierGroupService } from './service/product-modifier-group.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [
    ModifierGroupController,
    ModifierOptionController,
    ProductModifierGroupController,
  ],
  providers: [
    ModifierGroupService,
    ModifierOptionService,
    ProductModifierGroupService,
  ],
})
export class ModifierModule {}
