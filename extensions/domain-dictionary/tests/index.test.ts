import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

describe('Domain Dictionary Extension - Feature Flag', () => {
  const mockRegisterCommand = vi.fn();
  const mockPi = {
    registerCommand: mockRegisterCommand,
  } as unknown as ExtensionAPI;

  beforeEach(() => {
    mockRegisterCommand.mockClear();
    delete process.env.PI_ENABLE_DOMAIN_DICT;
  });

  afterEach(() => {
    delete process.env.PI_ENABLE_DOMAIN_DICT;
  });

  it('is disabled by default (no env var)', async () => {
    const { default: extension } = await import('../index.js');
    extension(mockPi);
    expect(mockRegisterCommand).not.toHaveBeenCalled();
  });

  it('is disabled when env var is "0"', async () => {
    process.env.PI_ENABLE_DOMAIN_DICT = '0';
    const { default: extension } = await import('../index.js');
    extension(mockPi);
    expect(mockRegisterCommand).not.toHaveBeenCalled();
  });

  it('is disabled when env var is "false"', async () => {
    process.env.PI_ENABLE_DOMAIN_DICT = 'false';
    const { default: extension } = await import('../index.js');
    extension(mockPi);
    expect(mockRegisterCommand).not.toHaveBeenCalled();
  });

  it('is enabled when env var is "1"', async () => {
    process.env.PI_ENABLE_DOMAIN_DICT = '1';
    const { default: extension } = await import('../index.js');
    extension(mockPi);
    expect(mockRegisterCommand).toHaveBeenCalledTimes(2);
    expect(mockRegisterCommand).toHaveBeenCalledWith('dict', expect.any(Object));
    expect(mockRegisterCommand).toHaveBeenCalledWith('dict-build', expect.any(Object));
  });

  it('is enabled when env var is "true"', async () => {
    process.env.PI_ENABLE_DOMAIN_DICT = 'true';
    const { default: extension } = await import('../index.js');
    extension(mockPi);
    expect(mockRegisterCommand).toHaveBeenCalledTimes(2);
  });
});
