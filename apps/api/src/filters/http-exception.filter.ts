import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let error: string;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        const rawMessage = resp['message'];
        message = Array.isArray(rawMessage)
          ? rawMessage.join('; ')
          : String(rawMessage ?? exception.message);
        error = String(resp['error'] ?? exception.name);
      } else {
        message = String(exceptionResponse);
        error = exception.name;
      }

      this.logger.warn({ statusCode: status, error }, message);

      const body: Record<string, unknown> = { statusCode: status, error, message };

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        if (typeof resp['errorCode'] === 'string') {
          body['errorCode'] = resp['errorCode'];
        }
      }

      response.status(status).json(body);
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
        'Unhandled exception',
      );

      response.status(500).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
    }
  }
}
