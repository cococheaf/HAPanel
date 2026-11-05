import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOptions,
  nextOption,
  entityDetails,
  type SelectOption,
} from '../src/client/editor/select-options';
const options: SelectOption[] = [
  {
    value: 'light.kitchen_ceiling',
    label: 'Decke',
    description: 'Küche · Shelly Dimmer',
    group: 'EG',
  },
  { value: 'light.study', label: 'Stehlampe', description: 'Büro · WLED', group: 'OG' },
  { value: 'sensor.entrance', label: 'Straße außen', group: 'EG' },
  { value: 'light.missing', label: 'Nicht verfügbar', disabled: true },
];
test('designer search finds entity IDs, room metadata, German spellings and combined terms', () => {
  assert.equal(filterOptions(options, 'kitchen ceiling')[0]?.value, 'light.kitchen_ceiling');
  assert.equal(filterOptions(options, 'eg kueche dimmer')[0]?.value, 'light.kitchen_ceiling');
  assert.equal(filterOptions(options, 'büro WLED')[0]?.value, 'light.study');
  assert.equal(filterOptions(options, 'buero')[0]?.value, 'light.study');
  assert.equal(filterOptions(options, 'strasse aussen')[0]?.value, 'sensor.entrance');
  assert.equal(filterOptions(options, 'og Küche').length, 0);
  assert.equal(
    filterOptions(
      [
        {
          value: 'light.same',
          label: 'Decke',
          description: entityDetails({
            entity_id: 'light.same',
            area: { id: 'office', name: 'Büro', floor: 'OG' },
            deviceName: 'Shelly',
          }),
        },
      ],
      'og buero shelly',
    )[0]?.value,
    'light.same',
  );
});
test('current selection leads an unfiltered list without changing its source or bypassing a query', () => {
  const before = structuredClone(options);
  assert.equal(filterOptions(options, '', 'light.study')[0].value, 'light.study');
  assert.equal(filterOptions(options, 'kitchen', 'light.study').length, 1);
  assert.deepEqual(options, before);
  assert.equal(filterOptions(options, 'unknown', 'light.study').length, 0);
});
test('keyboard navigation wraps and skips unavailable choices without inventing a selection', () => {
  assert.equal(nextOption(options, -1, 1), 0);
  assert.equal(nextOption(options, -1, -1), 2);
  assert.equal(nextOption(options, 2, 1), 0);
  assert.equal(nextOption(options, 0, -1), 2);
  assert.equal(nextOption([{ value: 'a', label: 'Unavailable', disabled: true }], -1, 1), -1);
  assert.equal(nextOption([], -1, 1), -1);
});
test('search covers the entire catalog even when a UI only renders a result page', () => {
  const large = Array.from({ length: 10000 }, (_, i) => ({
    value: `sensor.room_${i}`,
    label: `Room ${i}`,
    description: i === 9999 ? 'Ziel Küche' : 'Messwert',
  }));
  assert.equal(filterOptions(large, 'ziel kueche')[0].value, 'sensor.room_9999');
  assert.equal(filterOptions(large, 'room 9999').length, 1);
  assert.equal(filterOptions(large, 'not present').length, 0);
});
