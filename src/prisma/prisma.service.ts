import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.get<string>('database.url'),
    });
    const isDev = process.env.NODE_ENV !== 'production';

    super({
      adapter,
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ],
    });
  }

  async onModuleInit() {
    (this as any).$on('query', (e: any) => {
      const sql = e.query
        .replace(/\s+/g, ' ')
        .replace(
          /\s+(FROM|WHERE|LIMIT|OFFSET|ORDER BY|GROUP BY|SET|VALUES)\s+/gi,
          '\n$1 ',
        );
      this.logger.debug(
        [
          'Database Query',
          ` Duration: ${e.duration}ms`,
          ' SQL:',
          ` ${sql}`,
          ' Params:',
          ` ${e.params}`,
        ].join('\n'),
      );
    });
    (this as any).$on('error', (e: any) => {
      this.logger.error(e.message);
    });
    (this as any).$on('warn', (e: any) => {
      this.logger.warn(e.message);
    });
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
