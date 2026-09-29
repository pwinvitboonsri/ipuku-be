type SortOrder = 'asc' | 'desc';

type SortType = 'name' | 'sort_order';

export function sortData<T extends Record<string, unknown>>(
  data: T[],
  type: SortType,
  order: SortOrder = 'asc',
): T[] {
  return [...data].sort((a, b) => {
    const valueA = a[type];
    const valueB = b[type];

    if (valueA === valueB) return 0;

    if (valueA === undefined || valueA === null) return 1;
    if (valueB === undefined || valueB === null) return -1;

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      const result = valueA.localeCompare(valueB);
      return order === 'asc' ? result : -result;
    }

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      const result = valueA - valueB;
      return order === 'asc' ? result : -result;
    }

    return 0;
  });
}