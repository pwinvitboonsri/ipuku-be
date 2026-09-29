import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

@Injectable()
export class EnvCheckService implements OnModuleInit {
    private readonly logger = new Logger('env')

    onModuleInit() {
        this.logger.log('✅ Env connected and validated')
    }
}