import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      code = exception.code;

      switch (exception.code) {
        // Record not found / operation failed because record does not exist
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;

        // Unique constraint failed
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          break;

        // Foreign key constraint failed
        case 'P2003':
          status = HttpStatus.CONFLICT;
          message = 'Related record does not exist or cannot be deleted';
          break;

        // Required relation violation
        case 'P2014':
          status = HttpStatus.CONFLICT;
          message = 'The requested change violates a required relation';
          break;

        // Records required but not found
        case 'P2015':
          status = HttpStatus.NOT_FOUND;
          message = 'Related record not found';
          break;

        // Null constraint violation
        case 'P2011':
          status = HttpStatus.BAD_REQUEST;
          message = 'A required field cannot be null';
          break;

        // Value too long
        case 'P2000':
          status = HttpStatus.BAD_REQUEST;
          message = 'A provided value is too long';
          break;

        // Invalid input value
        case 'P2006':
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid value provided';
          break;

        // Value out of range
        case 'P2004':
          status = HttpStatus.BAD_REQUEST;
          message = 'The provided value is invalid';
          break;

        // Transaction conflict / deadlock
        case 'P2034':
          status = HttpStatus.CONFLICT;
          message = 'Transaction conflict. Please retry the request';
          break;

        default:
          this.logger.error(
            `Unhandled Prisma error ${exception.code}`,
            exception,
          );

          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Database operation failed';
      }
    } else if (
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid database query';
      this.logger.error(exception.message);
    } else if (
      exception instanceof Prisma.PrismaClientInitializationError
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database unavailable';

      this.logger.error(exception.message);
    } else if (
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database engine error';

      this.logger.error(exception.message);
    } else if (
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown database error';

      this.logger.error(exception.message);
    }

    return response.status(status).json({
      statusCode: status,
      error: this.getErrorName(status),
      message,
      ...(code && { code }),
    });
  }

  private getErrorName(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';

      case HttpStatus.NOT_FOUND:
        return 'Not Found';

      case HttpStatus.CONFLICT:
        return 'Conflict';

      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';

      default:
        return 'Internal Server Error';
    }
  }
}