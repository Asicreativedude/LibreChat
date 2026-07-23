import { sortModelsByRecency } from './providers';

describe('sortModelsByRecency', () => {
  it('puts the newest OpenAI families on top and sinks legacy ones', () => {
    const sorted = sortModelsByRecency([
      'gpt-3.5-turbo',
      'gpt-4o',
      'gpt-4',
      'gpt-4.1',
      'gpt-5',
      'gpt-5.4',
      'gpt-4-0125',
      'gpt-4-turbo-2024-04-09',
      'gpt-5.1',
    ]);
    expect(sorted[0]).toBe('gpt-5.4');
    expect(sorted.indexOf('gpt-5.4')).toBeLessThan(sorted.indexOf('gpt-5.1'));
    expect(sorted.indexOf('gpt-5.1')).toBeLessThan(sorted.indexOf('gpt-4o'));
    expect(sorted.indexOf('gpt-4.1')).toBeLessThan(sorted.indexOf('gpt-4o'));
    expect(sorted.indexOf('gpt-4o')).toBeLessThan(sorted.indexOf('gpt-3.5-turbo'));
  });

  it('orders Claude by version, ignoring date snapshots', () => {
    const sorted = sortModelsByRecency([
      'claude-2.1',
      'claude-3-5-sonnet-20241022',
      'claude-opus-4-8',
      'claude-sonnet-5',
      'claude-fable-5',
      'claude-opus-4-1-20250805',
    ]);
    // v5 outranks v4.8; date suffix must not push 4.1 above 4.8
    expect(sorted.indexOf('claude-sonnet-5')).toBeLessThan(sorted.indexOf('claude-opus-4-8'));
    expect(sorted.indexOf('claude-opus-4-8')).toBeLessThan(
      sorted.indexOf('claude-opus-4-1-20250805'),
    );
    expect(sorted.indexOf('claude-opus-4-1-20250805')).toBeLessThan(
      sorted.indexOf('claude-3-5-sonnet-20241022'),
    );
    expect(sorted.indexOf('claude-3-5-sonnet-20241022')).toBeLessThan(sorted.indexOf('claude-2.1'));
  });

  it('is stable for same-version ties (keeps fetched order) and safe on empty', () => {
    expect(sortModelsByRecency(['claude-sonnet-5', 'claude-fable-5'])).toEqual([
      'claude-sonnet-5',
      'claude-fable-5',
    ]);
    expect(sortModelsByRecency([])).toEqual([]);
  });
});
