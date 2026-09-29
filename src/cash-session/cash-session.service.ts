import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OpenSessionDTO } from './dto/create-session.dto.js';
import { CloseSessionDTO } from './dto/close-session.dto.js';
import { GetSessionById } from './dto/get-session-by-id.dto.js';
import { GetSessionList } from './dto/get-session-list.dto.js';

@Injectable()
export class CashSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async currentSession() {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        close_at: null,
      },
    });

    return session;
  }

  async openSession(dto: OpenSessionDTO, actorStaffId: string) {
    const checkNonClosedSession = await this.prisma.cashSession.findFirst({
      where: {
        close_at: null,
      },
    });

    if (checkNonClosedSession)
      throw new BadGatewayException(
        'Opened Cash session exist, Please closed it first',
      );

    const session = await this.prisma.cashSession.create({
      data: {
        opening_float_satang: dto.opening_float_satang,
        opened_by_staff_id: actorStaffId,
      },
    });

    return session;
  }

  async closeSession(dto: CloseSessionDTO, actorStaffId: string) {

    const checkExistSession = await this.prisma.cashSession.findUniqueOrThrow({
      where: {
        id: dto.id,
        close_at: null,
        close_by_staff_id: null,
      },
    });

    const checkExistOrder = await this.prisma.order.count({
      where: {
        cash_session_id: dto.id,
        status: 'OPEN',
      },
    });

    if (checkExistOrder > 0)
      throw new BadRequestException('Still have order open');

    const cashSum = await this.prisma.payment.aggregate({
      where: {
        method: 'CASH',
        order: {
          cash_session_id: checkExistSession.id,
        },
      },
      _sum: {
        amount_satang: true,
      },
    });
    const totalCashPayments = cashSum._sum.amount_satang ?? 0;
    const expect_cash_satang =
      checkExistSession.opening_float_satang + totalCashPayments;
    const variance_satang = dto.counted_cash_satang - expect_cash_satang;

    return await this.prisma.cashSession.update({
      where: {
        id: checkExistSession.id,
      },
      data: {
        counted_cash_satang: dto.counted_cash_satang,
        expect_cash_satang: expect_cash_satang,
        variance_satang: variance_satang,
        close_at: new Date(),
        close_by_staff_id: actorStaffId,
      },
    });
  }

  async getSessionById(dto: GetSessionById) {
    return await this.prisma.cashSession.findUniqueOrThrow({
      where: {
        id: dto.id,
      },
    });
  }

  async getSessionList(dto: GetSessionList) {
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        open_at: {
          lte: dto.before,
          ...(dto.after && {
            gte: dto.after,
          }),
        },

        ...(dto.is_opening !== undefined && {
          close_at: dto.is_opening ? null : { not: null },
        }),

        ...(dto.opened_by_staff_id && {
          opened_by_staff_id: dto.opened_by_staff_id,
        }),

        ...(dto.close_by_staff_id && {
          close_by_staff_id: dto.close_by_staff_id,
        }),
      },
      orderBy: {
        open_at: 'desc',
      },
    });

    return sessions
  }
}
