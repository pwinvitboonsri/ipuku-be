import { Module } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
