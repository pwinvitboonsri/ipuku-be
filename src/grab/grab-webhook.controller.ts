import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GrabEnabledGuard } from './guard/grab-enabled.guard.js';
import { GrabWebhookGuard } from './guard/grab-webhook.guard.js';
import { GrabOrderService } from './grab-order.service.js';
import { GrabMenuService } from './grab-menu.service.js';
import { GrabSubmitOrderDTO } from './dto/grab-submit-order.dto.js';
import { GrabPushStateDTO } from './dto/grab-push-state.dto.js';
import { parseGrabBody } from './function/parse-grab-body.function.js';

// Endpoints Grab calls (registered in Grab's partner portal).
// Bodies are plain objects on purpose: parseGrabBody strips unknown fields
// instead of the global pipe rejecting them.
@SkipThrottle()
@UseGuards(GrabEnabledGuard, GrabWebhookGuard)
@Controller('grab')
export class GrabWebhookController {
  private readonly logger = new Logger(GrabWebhookController.name);

  constructor(
    private readonly grabOrderService: GrabOrderService,
    private readonly grabMenuService: GrabMenuService,
  ) {}

  @Get('merchant/menu')
  async menu(@Query() query: Record<string, string>) {
    return await this.grabMenuService.getMenu(query.partnerMerchantID);
  }

  @Post('orders')
  @HttpCode(HttpStatus.OK)
  async submitOrder(@Body() body: Record<string, unknown>, @Req() req: any) {
    const dto = parseGrabBody(GrabSubmitOrderDTO, body);
    const result = await this.grabOrderService.receive(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true, data: result };
  }

  @Put('orders/state')
  @HttpCode(HttpStatus.OK)
  async pushState(@Body() body: Record<string, unknown>, @Req() req: any) {
    const dto = parseGrabBody(GrabPushStateDTO, body);
    const result = await this.grabOrderService.updateState(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true, data: result };
  }

  // not acted on yet: logged so the payloads can be seen during onboarding
  @Post('integration-status')
  @HttpCode(HttpStatus.OK)
  integrationStatus(@Body() body: Record<string, unknown>) {
    this.logger.log(`Integration status: ${JSON.stringify(body)}`);
    return { success: true };
  }

  @Post('menu-sync-state')
  @HttpCode(HttpStatus.OK)
  menuSyncState(@Body() body: Record<string, unknown>) {
    this.logger.log(`Menu sync state: ${JSON.stringify(body)}`);
    return { success: true };
  }
}
