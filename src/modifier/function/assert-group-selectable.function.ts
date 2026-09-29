import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export function assertMinMax(minSelect: number, maxSelect: number) {
  if (maxSelect < 1 || minSelect > maxSelect) {
    throw new BadRequestException(
      'max_select must be at least 1 and not less than min_select',
    );
  }
}

// A group must have enough active options to satisfy min_select,
// otherwise a required group can never be completed at the POS.
export async function assertGroupSelectable(
  prisma: PrismaService,
  groupId: string,
  minSelect: number,
  options: { onlyIfAttached?: boolean; excludeOptionId?: string } = {},
) {
  if (options.onlyIfAttached) {
    const attached = await prisma.productModifierGroup.count({
      where: { modifier_group_id: groupId },
    });

    if (attached === 0) return;
  }

  const activeOptions = await prisma.modifierOption.count({
    where: {
      group_id: groupId,
      is_active: true,
      ...(options.excludeOptionId && {
        id: { not: options.excludeOptionId },
      }),
    },
  });

  if (activeOptions < minSelect) {
    throw new BadRequestException(
      `Modifier group needs at least ${minSelect} active option(s), has ${activeOptions}`,
    );
  }
}
