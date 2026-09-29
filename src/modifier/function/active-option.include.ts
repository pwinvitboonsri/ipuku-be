import { Prisma } from '../../generated/prisma/client.js';

// Active options of a group, in display order (S -> M -> L)
export const activeOptionInclude = {
  modifier_option: {
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
  },
} satisfies Prisma.ModifierGroupInclude;

// Back office: owners can ask for inactive options too
export function optionInclude(includeInactive: boolean) {
  return {
    modifier_option: {
      where: includeInactive ? {} : { is_active: true },
      orderBy: { sort_order: 'asc' },
    },
  } satisfies Prisma.ModifierGroupInclude;
}
