import { Module } from '@nestjs/common';
import { IngredientService } from './ingredient.service.js';
import { IngredientController } from './ingredient.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [IngredientController],
  providers: [IngredientService],
})
export class IngredientModule {}
