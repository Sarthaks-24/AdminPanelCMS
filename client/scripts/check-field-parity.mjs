#!/usr/bin/env node
/**
 * Fails when the landing-page demo (src/content/scopeDemo.js) disagrees with the server.
 *
 * The demo claims that its field names, default sets and sample values are the real ones. This
 * script holds it to that by reading the server's own constants and models:
 *
 *   1. every field the demo lists for a section is in PUBLIC_FIELDS for that model;
 *   2. the demo's `withheldByDefault` is exactly the subset of its fields that is public but not
 *      in DEFAULT_FIELDS (so the demo's default state matches what the API serves by default);
 *   3. every sample item in POOL carries only the demo's fields (plus `_id` and the extra keys the
 *      fs tree reads), and each sample value's type matches the Mongoose schema;
 *   4. enum fields (Skill.proficiency, Project.mode) hold one of the schema's values.
 *
 * Run from client/: `node scripts/check-field-parity.mjs`. Part of `npm run lint`.
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const serverRoot = path.resolve(clientRoot, '..', 'server');
const require = createRequire(path.join(serverRoot, 'package.json'));

const problems = [];
const fail = (message) => problems.push(message);

const { PUBLIC_FIELDS, DEFAULT_FIELDS } = require('./lib/modelConstants.js');

let models = {};
try {
  models = {
    Profile: require('./models/Profile.js'),
    Project: require('./models/Project.js'),
    Skill: require('./models/Skill.js'),
  };
} catch (error) {
  fail(`could not load the server models (${error.message}); run \`npm install\` in server/ first`);
}

const demo = await import(pathToFileURL(path.join(clientRoot, 'src', 'content', 'scopeDemo.js')).href);
const { SECTIONS, POOL } = demo;

// Keys the demo's fs-tree mirror reads straight off the pool, beyond the granted fields.
const EXTRA_POOL_KEYS = { profile: ['aboutMarkdown', 'location.isRemoteAvailable'], projects: [], skills: [] };

const getPath = (value, p) => p.split('.').reduce((current, key) => (current == null ? undefined : current[key]), value);

function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}

function schemaTypeOf(model, fieldPath) {
  const schemaPath = model?.schema?.path(fieldPath);
  if (!schemaPath) return null;
  return { instance: schemaPath.instance, enumValues: schemaPath.enumValues || [], caster: schemaPath.caster?.instance || null };
}

function matchesType(value, type) {
  switch (type.instance) {
    case 'String': return typeof value === 'string';
    case 'Number': return typeof value === 'number';
    case 'Boolean': return typeof value === 'boolean';
    case 'Date': return value instanceof Date || typeof value === 'string';
    case 'Array': return Array.isArray(value) && (!type.caster || value.every((entry) => matchesType(entry, { instance: type.caster })));
    default: return true;
  }
}

for (const section of SECTIONS) {
  if (!section.model) continue; // fs has no model of its own
  const publicFields = PUBLIC_FIELDS[section.model];
  const defaultFields = DEFAULT_FIELDS[section.model];
  if (!publicFields || !defaultFields) { fail(`${section.key}: no PUBLIC_FIELDS/DEFAULT_FIELDS for model ${section.model}`); continue; }

  for (const field of section.fields) {
    if (!publicFields.includes(field)) fail(`${section.key}: "${field}" is not in PUBLIC_FIELDS.${section.model}`);
  }

  const expectedWithheld = section.fields.filter((field) => publicFields.includes(field) && !defaultFields.includes(field));
  const actualWithheld = [...section.withheldByDefault].sort();
  if (JSON.stringify(actualWithheld) !== JSON.stringify([...expectedWithheld].sort())) {
    fail(`${section.key}: withheldByDefault is [${actualWithheld}] but the server withholds [${expectedWithheld}] by default`);
  }

  const items = section.key === 'profile' ? [POOL.profile] : POOL[section.key];
  const allowed = new Set(['_id', ...section.fields, ...EXTRA_POOL_KEYS[section.key]]);
  const model = models[section.model];
  items.forEach((item, index) => {
    for (const leaf of leafPaths(item)) {
      if (!allowed.has(leaf)) fail(`${section.key}[${index}]: sample carries "${leaf}", which the demo never lists`);
    }
    if (!model) return;
    for (const field of section.fields) {
      const value = getPath(item, field);
      if (value === undefined) continue;
      const type = schemaTypeOf(model, field);
      if (!type) { fail(`${section.key}: "${field}" is not a path on the ${section.model} schema`); continue; }
      if (!matchesType(value, type)) fail(`${section.key}[${index}].${field}: sample is ${typeof value}, schema says ${type.instance}`);
      if (type.enumValues.length && !type.enumValues.includes(value)) {
        fail(`${section.key}[${index}].${field}: "${value}" is not one of ${type.enumValues.join(' | ')}`);
      }
    }
  });
}

if (problems.length) {
  console.error('check-field-parity: the landing demo disagrees with the server:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nFix src/content/scopeDemo.js (or the server constants, if they are the ones that changed).');
  process.exit(1);
}

console.log(`check-field-parity: ${SECTIONS.filter((section) => section.model).length} demo sections match server/lib/modelConstants.js and the models.`);
process.exit(0);
