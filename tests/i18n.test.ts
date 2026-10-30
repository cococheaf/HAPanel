import test from 'node:test';
import assert from 'node:assert/strict';
import {
  languages,
  resolveLanguage,
  translate,
  UserError,
  errorMessage,
  type MessageKey,
} from '../src/shared/i18n';
import {
  demoDocument,
  localizeSampleDocument,
  sampleEntityName,
  demoSnapshot,
} from '../src/shared/demo';
import { dashboardSchema } from '../src/shared/model';

test('every supported language has all messages and the same interpolation parameters', () => {
  const keys = Object.keys(languages.en.messages).sort() as MessageKey[];
  const placeholders = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const definition of Object.values(languages)) {
    assert.deepEqual(Object.keys(definition.messages).sort(), keys);
    for (const key of keys) {
      assert.ok(definition.messages[key].trim(), `${definition.name}: ${key}`);
      assert.deepEqual(
        placeholders(definition.messages[key]),
        placeholders(languages.en.messages[key]),
        key,
      );
    }
  }
});
test('browser and HTTP language negotiation respect preference, region and fallback', () => {
  assert.equal(resolveLanguage(['de-DE', 'en-US']), 'de');
  assert.equal(resolveLanguage(['en-US', 'de-AT']), 'en');
  assert.equal(resolveLanguage('de;q=0.2, en-GB;q=0.9'), 'en');
  assert.equal(resolveLanguage('de;q=0,en;q=1'), 'en');
  assert.equal(resolveLanguage('fr-FR, de-AT;q=0.7'), 'de');
  assert.equal(resolveLanguage('fr-FR'), 'en');
  assert.equal(resolveLanguage(undefined), 'en');
});
test('whole translated messages preserve names and format dynamic values', () => {
  assert.equal(
    translate('en', 'dashboard.turnOn', { title: 'Reading light' }),
    'Turn on Reading light',
  );
  assert.equal(translate('de', 'editor.newPage', { number: 3 }), 'Seite 3');
  assert.match(errorMessage(new UserError('error.pairCode'), 'en'), /expired/);
  assert.match(errorMessage(new UserError('error.pairCode'), 'de'), /abgelaufen/);
  assert.equal((22.5).toLocaleString(languages.en.intlLocale), '22.5');
  assert.equal((22.5).toLocaleString(languages.de.intlLocale), '22,5');
});
test('sample localisation never rewrites custom text, layouts, entity IDs or the source document', () => {
  const document = structuredClone(demoDocument);
  document.greeting = 'Our own greeting';
  document.pages[0].tiles[1].title = 'Meine eigene Lampe';
  const before = JSON.stringify(document);
  const view = localizeSampleDocument(document, 'en');
  assert.equal(view.name, 'My home');
  assert.equal(view.greeting, 'Our own greeting');
  assert.equal(view.pages[0].tiles[0].title, 'Vienna');
  assert.equal(view.pages[0].tiles[1].title, 'Meine eigene Lampe');
  assert.deepEqual(view.pages[0].tiles[1].layouts, document.pages[0].tiles[1].layouts);
  assert.equal(view.pages[0].tiles[1].entityId, document.pages[0].tiles[1].entityId);
  assert.equal(JSON.stringify(document), before);
  assert.equal(dashboardSchema.safeParse(view).success, true);
  const entity = demoSnapshot().entities['light.kitchen'];
  assert.equal(sampleEntityName(entity, 'en'), 'Kitchen light');
  entity.attributes.friendly_name = 'User supplied name';
  assert.equal(sampleEntityName(entity, 'de'), 'User supplied name');
});
