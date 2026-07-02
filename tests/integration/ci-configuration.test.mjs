import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

describe('CI configuration', () => {
  it('uses Turborepo for workspace build, lint, and test orchestration', () => {
    const rootPackage = readJson('package.json');
    assert.equal(rootPackage.scripts.build, 'turbo run build');
    assert.equal(rootPackage.scripts.lint, 'turbo run lint');
    assert.match(rootPackage.scripts.test, /turbo run test/);
    assert.ok(rootPackage.devDependencies.turbo);
  });

  it('declares root ESLint dependencies used by Next.js apps', () => {
    const rootPackage = readJson('package.json');
    assert.ok(rootPackage.devDependencies.eslint);
    assert.ok(rootPackage.devDependencies['eslint-config-next']);
    assert.ok(rootPackage.devDependencies['@typescript-eslint/parser']);
    assert.ok(rootPackage.devDependencies['@typescript-eslint/eslint-plugin']);
  });

  it('maps @hololed/shared workspace packages in the shared TypeScript base config', () => {
    const tsconfig = readJson('tsconfig.base.json');
    assert.deepEqual(tsconfig.compilerOptions.paths['@hololed/*'], ['packages/*/src']);
  });

  it('declares @hololed/shared as an API dependency', () => {
    const apiPackage = readJson('apps/api/package.json');
    assert.equal(apiPackage.dependencies['@hololed/shared'], '1.0.0');
  });

  it('uses patched Fastify gateway dependencies without known critical proxy advisory range', () => {
    const gatewayPackage = readJson('apps/gateway/package.json');
    assert.match(gatewayPackage.dependencies['@fastify/http-proxy'], /\^11\./);
    assert.match(gatewayPackage.dependencies['@fastify/helmet'], /\^13\./);
    assert.match(gatewayPackage.dependencies['@fastify/rate-limit'], /\^11\./);
  });

  it('blocks high and critical audit findings in the security workflow', () => {
    const securityWorkflow = readText('.github/workflows/security.yml');
    assert.match(securityWorkflow, /npm audit --audit-level=high/);
  });
});
