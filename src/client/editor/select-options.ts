import type { EntityState } from '../../shared/model';

export function entityDetails(entity: Pick<EntityState, 'entity_id' | 'area' | 'deviceName'>) {
  return [entity.area?.floor, entity.area?.name, entity.deviceName, entity.entity_id]
    .filter(Boolean)
    .join(' · ');
}

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
};

/** Match spoken names, Home Assistant IDs and German spellings using the same query. */
export function searchText(value: string) {
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[_./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterOptions(options: SelectOption[], query: string, selected?: string) {
  const terms = searchText(query).split(' ').filter(Boolean);
  const matches = options.filter((option) => {
    const text = searchText(
      [option.label, option.value, option.description, option.group].filter(Boolean).join(' '),
    );
    return terms.every((term) => text.includes(term));
  });
  if (!terms.length && selected !== undefined) {
    const index = matches.findIndex((option) => option.value === selected);
    if (index > 0) matches.unshift(...matches.splice(index, 1));
  }
  return matches;
}

export function nextOption(options: SelectOption[], current: number, direction: 1 | -1) {
  if (!options.length) return -1;
  if (current < 0 || current >= options.length) current = direction === 1 ? -1 : 0;
  for (let step = 1; step <= options.length; step++) {
    const index = (current + direction * step + options.length * 2) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}
