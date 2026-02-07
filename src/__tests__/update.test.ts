import { describe, expect, it } from 'vitest';
import { checkForUpdate } from '../update.js';

describe('checkForUpdate', () => {
  it('detects when a newer version is available', async () => {
    // @clack/prompts is a real package that will always be > 0.0.0
    const result = await checkForUpdate('@clack/prompts', '0.0.0');
    expect(result).not.toBeNull();
    expect(result?.updateAvailable).toBe(true);
    expect(result?.current).toBe('0.0.0');
    expect(result?.latest).toBeTruthy();
  });

  it('reports no update when current is latest', async () => {
    const result = await checkForUpdate('@clack/prompts', '999.999.999');
    expect(result).not.toBeNull();
    expect(result?.updateAvailable).toBe(false);
  });

  it('returns null for non-existent package', async () => {
    const result = await checkForUpdate(
      '@kunobi/this-package-does-not-exist-xyz',
      '0.0.0',
    );
    expect(result).toBeNull();
  });

  it('returns null on timeout', async () => {
    const result = await checkForUpdate('@clack/prompts', '0.0.0', 1);
    expect(result).toBeNull();
  });
});
