import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { MenuService } from './menu.service.js';
import { MenuController } from './menu.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
