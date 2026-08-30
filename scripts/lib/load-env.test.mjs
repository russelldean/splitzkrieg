import { describe, it, expect } from 'vitest';
import { parseEnvFile, missingVars, REQUIRED_DB_VARS } from './load-env.mjs';

/**
 * The DB scripts all read .env.local unguarded, so they threw the moment they
 * ran anywhere but Russ's machine. That is part of why none of them had ever
 * run on a schedule.
 */
describe('parseEnvFile', () => {
  it('reads plain key=value lines', () => {
    expect(parseEnvFile('A=1\nB=two')).toEqual({ A: '1', B: 'two' });
  });

  it('skips blanks and comments', () => {
    expect(parseEnvFile('\n# a comment\nA=1\n\n')).toEqual({ A: '1' });
  });

  it('keeps = inside a value, which passwords and connection strings contain', () => {
    expect(parseEnvFile('PW=ab=cd==')).toEqual({ PW: 'ab=cd==' });
  });

  it('strips matched surrounding quotes', () => {
    expect(parseEnvFile('A="x"\nB=\'y\'')).toEqual({ A: 'x', B: 'y' });
  });

  it('leaves an unmatched quote alone', () => {
    expect(parseEnvFile('A="x')).toEqual({ A: '"x' });
  });

  it('ignores a line with no equals sign', () => {
    expect(parseEnvFile('nonsense\nA=1')).toEqual({ A: '1' });
  });

  it('returns empty for empty or missing contents', () => {
    expect(parseEnvFile('')).toEqual({});
    expect(parseEnvFile(undefined)).toEqual({});
  });
});

describe('missingVars', () => {
  const full = Object.fromEntries(REQUIRED_DB_VARS.map((k) => [k, 'set']));

  it('is empty when everything is present', () => {
    expect(missingVars(full)).toEqual([]);
  });

  it('names what is absent', () => {
    const { AZURE_SQL_PASSWORD, ...rest } = full;
    expect(missingVars(rest)).toEqual(['AZURE_SQL_PASSWORD']);
  });

  it('lets the file fill a gap the environment does not cover', () => {
    const { AZURE_SQL_USER, ...rest } = full;
    expect(missingVars(rest, { AZURE_SQL_USER: 'from-file' })).toEqual([]);
  });

  it('treats an empty string as missing, not as set', () => {
    expect(missingVars({ ...full, AZURE_SQL_SERVER: '' })).toEqual(['AZURE_SQL_SERVER']);
  });
});
