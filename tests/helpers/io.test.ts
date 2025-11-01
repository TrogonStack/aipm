import { describe, expect, test } from 'bun:test';
import { MockIO } from '../../src/helpers/io';

describe('MockIO', () => {
  test('tracks confirm calls and responses', async () => {
    const io = new MockIO();
    io.confirmResponses = [true, false, true];

    const result1 = await io.confirm('First question?');
    const result2 = await io.confirm('Second question?');
    const result3 = await io.confirm('Third question?');

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(result3).toBe(true);

    expect(io.logs).toHaveLength(3);
    expect(io.logs[0]).toEqual({ type: 'confirm', message: 'First question?' });
    expect(io.logs[1]).toEqual({
      type: 'confirm',
      message: 'Second question?',
    });
    expect(io.logs[2]).toEqual({ type: 'confirm', message: 'Third question?' });
  });

  test('defaults to false when no confirm response configured', async () => {
    const io = new MockIO();

    const result = await io.confirm('Question?');

    expect(result).toBe(false);
  });

  test('tracks logSuccess calls', () => {
    const io = new MockIO();

    io.logSuccess('Operation succeeded');

    expect(io.logs).toHaveLength(1);
    expect(io.logs[0]).toEqual({
      type: 'success',
      message: 'Operation succeeded',
    });
  });

  test('tracks logError calls', () => {
    const io = new MockIO();

    io.logError('Operation failed');

    expect(io.logs).toHaveLength(1);
    expect(io.logs[0]).toEqual({ type: 'error', message: 'Operation failed' });
  });

  test('tracks logInfo calls', () => {
    const io = new MockIO();

    io.logInfo('Information message');

    expect(io.logs).toHaveLength(1);
    expect(io.logs[0]).toEqual({
      type: 'info',
      message: 'Information message',
    });
  });

  test('tracks log calls', () => {
    const io = new MockIO();

    io.log('Regular message');

    expect(io.logs).toHaveLength(1);
    expect(io.logs[0]).toEqual({ type: 'log', message: 'Regular message' });
  });

  test('tracks multiple log types', () => {
    const io = new MockIO();

    io.log('Message 1');
    io.logInfo('Message 2');
    io.logSuccess('Message 3');
    io.logError('Message 4');

    expect(io.logs).toHaveLength(4);
    expect(io.logs[0]?.type).toBe('log');
    expect(io.logs[1]?.type).toBe('info');
    expect(io.logs[2]?.type).toBe('success');
    expect(io.logs[3]?.type).toBe('error');
  });

  test('reset clears all state', async () => {
    const io = new MockIO();
    io.confirmResponses = [true, false];

    await io.confirm('Question 1?');
    io.logSuccess('Success');
    io.logError('Error');

    expect(io.logs).toHaveLength(3);

    io.reset();

    expect(io.logs).toHaveLength(0);
    expect(io.confirmResponses).toHaveLength(0);

    const result = await io.confirm('Question 2?');
    expect(result).toBe(false);
  });
});
