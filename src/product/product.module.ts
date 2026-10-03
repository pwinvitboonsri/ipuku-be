import { Module } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ProductController } from './product.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CommonModule,
    StorageModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
