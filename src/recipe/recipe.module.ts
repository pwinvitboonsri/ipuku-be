import { Module } from '@nestjs/common';
import { RecipeService } from './recipe.service.js';
import { RecipeController } from './recipe.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [RecipeController],
  providers: [RecipeService],
})
export class RecipeModule {}
