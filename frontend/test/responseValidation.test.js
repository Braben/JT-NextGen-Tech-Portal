import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateApiResponse, requireList } from '../src/api/responseValidation.js';

test('rejects successful SPA HTML responses before they enter state', () => {
  assert.throws(() => validateApiResponse({ headers: { 'content-type': 'text/html' }, data: '<html></html>' }), /API returned a web page/);
  assert.throws(() => validateApiResponse({ data: '<!DOCTYPE html><html></html>' }), /API returned a web page/);
});

test('preserves JSON and binary downloads', () => {
  for (const data of [[], { id: 1 }, new Uint8Array([1, 2])]) {
    const response = { data };
    assert.equal(validateApiResponse(response), response);
  }
});

test('list data must be an array, including empty results', () => {
  assert.deepEqual(requireList([]), []);
  assert.deepEqual(requireList([{ id: 1 }]), [{ id: 1 }]);
  for (const data of ['<html>', {}, null, undefined]) assert.throws(() => requireList(data), /invalid list/);
});
