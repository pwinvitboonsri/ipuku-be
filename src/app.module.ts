import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envValidationSchema } from './config/env/env.validation.js';
import dbConfig from './config/env/db.config.js';
import jwtConfig from './config/env/jwt.config.js';
import { EnvCheckService } from './config/env/env-check.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CategoryModule } from './category/category.module.js';
import { CashSessionModule } from './cash-session/cash-session.module.js';
import { ProductModule } from './product/product.module.js';
import { IngredientModule } from './ingredient/ingredient.module.js';
import { RecipeModule } from './recipe/recipe.module.js';
import { ModifierModule } from './modifier/modifier.module.js';
import { OrderModule } from './order/order.module.js';
import { StockMovementModule } from './stock-movement/stock-movement.module.js';
import { MenuModule } from './menu/menu.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      validationSchema: envValidationSchema,
      load: [dbConfig, jwtConfig],
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: 60000,
          limit: config.get<number>('THROTTLE_LIMIT', 600),
        },
      ],
    }),
    AuthModule,
    PrismaModule,
    HealthModule,
    CategoryModule,
    CashSessionModule,
    ProductModule,
    IngredientModule,
    RecipeModule,
    ModifierModule,
    OrderModule,
    StockMovementModule,
    MenuModule,
  ],
  controllers: [],
  providers: [
    EnvCheckService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
