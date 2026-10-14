import { BadRequestException } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

// Validates a Grab request body against a DTO, stripping unknown fields instead of
// rejecting them. The global ValidationPipe uses forbidNonWhitelisted, which would
// 400 every webhook the day Grab adds a field (and Grab would retry it forever), so
// Grab controllers take the body as a plain object and call this instead.
export function parseGrabBody<T extends object>(
  cls: ClassConstructor<T>,
  body: unknown,
): T {
  const instance = plainToInstance(cls, body ?? {});
  const errors = validateSync(instance, { whitelist: true });

  if (errors.length > 0) {
    const messages = errors.flatMap(function flatten(e): string[] {
      return [
        ...Object.values(e.constraints ?? {}),
        ...(e.children ?? []).flatMap(flatten),
      ];
    });
    throw new BadRequestException(messages);
  }

  return instance;
}
