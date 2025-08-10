import { describe, it, expect, vi, beforeEach, test } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

import { Compile, runFile } from '../src/index.js';
describe('Mlem build', () => {
  it('should return correct source file', async () => {
    const source = fs.readFileSync(await Compile('mlem/test.mlem'), 'utf8');
    const tested = fs.readFileSync('mlem/test.mlemjs', 'utf8');
    expect(source.trim()).toBe(tested.trim());
  });
  it('should exec without error', async () => {
    const source = await Compile('mlem/test.mlem');
    expect(() => runFile(source)).not.toThrow();
  });
});
