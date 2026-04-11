import { beforeEach, describe, expect, it, vi } from 'vitest';
import extension from '../index.js';
import { FileFinder } from '@ff-labs/fff-node';

vi.mock('@ff-labs/fff-node', () => ({
  FileFinder: {
    create: vi.fn(),
  },
}));

vi.mock('@mariozechner/pi-coding-agent', () => ({
  getAgentDir: () => '/tmp/pi-agent',
  truncateHead: (content: string) => ({ content, truncated: false }),
  DEFAULT_MAX_BYTES: 1024 * 1024,
  formatSize: (bytes: number) => `${bytes}B`,
  CustomEditor: class {
    setAutocompleteProvider() {}
  },
}));

vi.mock('@mariozechner/pi-tui', () => ({
  Text: class {
    private value = '';
    constructor(_text = '', _x = 0, _y = 0) {}
    setText(text: string) {
      this.value = text;
    }
    getText() {
      return this.value;
    }
  },
}));

const createMockFinder = () => ({
  isDestroyed: false,
  waitForScan: vi.fn().mockResolvedValue({ ok: true, value: true }),
  fileSearch: vi.fn(),
  grep: vi.fn(),
  multiGrep: vi.fn(),
  healthCheck: vi.fn(() => ({
    ok: true,
    value: {
      version: '0.5.2',
      git: { repositoryFound: true, workdir: '/repo' },
      filePicker: { initialized: true, indexedFiles: 42 },
      frecency: { initialized: true },
      queryTracker: { initialized: true },
    },
  })),
  getScanProgress: vi.fn(() => ({ ok: true, value: { isScanning: false, scannedFilesCount: 42 } })),
  scanFiles: vi.fn(() => ({ ok: true, value: undefined })),
  destroy: vi.fn(function (this: any) {
    this.isDestroyed = true;
  }),
});

function createMockPi() {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const events = new Map<string, any[]>();
  const flags = new Map<string, any>();

  const mockPi: any = {
    registerTool: (def: any) => tools.set(def.name, def),
    registerCommand: (name: string, def: any) => commands.set(name, def),
    registerFlag: (name: string, def: any) => flags.set(name, def),
    on: (event: string, handler: any) => {
      if (!events.has(event)) events.set(event, []);
      events.get(event)!.push(handler);
    },
    getFlag: vi.fn(() => undefined),
  };

  return { mockPi, tools, commands, events, flags };
}

describe('fff-search extension', () => {
  let finder: ReturnType<typeof createMockFinder>;

  beforeEach(() => {
    finder = createMockFinder();
    vi.clearAllMocks();
    vi.mocked(FileFinder.create).mockReturnValue({ ok: true, value: finder } as any);
  });

  it('registers override tools, commands, flags, and lifecycle handlers', () => {
    const { mockPi, tools, commands, events, flags } = createMockPi();

    extension(mockPi);

    expect(tools.has('find')).toBe(true);
    expect(tools.has('grep')).toBe(true);
    expect(tools.has('multi_grep')).toBe(true);
    expect(commands.has('fff-mode')).toBe(true);
    expect(commands.has('fff-health')).toBe(true);
    expect(commands.has('fff-rescan')).toBe(true);
    expect(flags.has('fff-mode')).toBe(true);
    expect(events.has('session_start')).toBe(true);
    expect(events.has('session_shutdown')).toBe(true);
  });

  it('initializes FileFinder with persisted database paths on session start', async () => {
    const { mockPi, events } = createMockPi();
    extension(mockPi);

    const ctx: any = {
      cwd: '/repo',
      ui: {
        setEditorComponent: vi.fn(),
        notify: vi.fn(),
      },
    };

    const handler = events.get('session_start')?.[0];
    await handler?.({ type: 'session_start' }, ctx);

    expect(FileFinder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: '/repo',
        frecencyDbPath: '/tmp/pi-agent/fff/frecency.mdb',
        historyDbPath: '/tmp/pi-agent/fff/history.mdb',
        aiMode: true,
      })
    );
    expect(finder.waitForScan).toHaveBeenCalledWith(15000);
  });

  it('installs the FFF editor wrapper by default on session start', async () => {
    const { mockPi, events } = createMockPi();
    extension(mockPi);

    const ctx: any = {
      cwd: '/repo',
      ui: {
        setEditorComponent: vi.fn(),
        notify: vi.fn(),
      },
    };

    await events.get('session_start')?.[0]?.({ type: 'session_start' }, ctx);

    expect(ctx.ui.setEditorComponent).toHaveBeenCalledWith(expect.any(Function));
  });

  it('disables editor replacement in tools-only mode', async () => {
    const { mockPi, events } = createMockPi();
    mockPi.getFlag.mockReturnValue('tools-only');
    extension(mockPi);

    const ctx: any = {
      cwd: '/repo',
      ui: {
        setEditorComponent: vi.fn(),
        notify: vi.fn(),
      },
    };

    await events.get('session_start')?.[0]?.({ type: 'session_start' }, ctx);

    expect(ctx.ui.setEditorComponent).toHaveBeenCalledWith(undefined);
  });

  it('find delegates to fileSearch and returns relative paths', async () => {
    finder.fileSearch.mockReturnValue({
      ok: true,
      value: {
        items: [{ relativePath: 'src/index.ts' }],
        totalMatched: 1,
        totalFiles: 10,
      },
    });

    const { mockPi, tools } = createMockPi();
    extension(mockPi);

    const result = await tools.get('find').execute('tool-1', { pattern: 'index.ts' });

    expect(finder.fileSearch).toHaveBeenCalledWith('index.ts', { pageSize: 200 });
    expect(result.content[0].text).toContain('src/index.ts');
  });

  it('grep uses plain mode by default and prepends path constraints to the query', async () => {
    finder.grep.mockReturnValue({
      ok: true,
      value: {
        items: [{ relativePath: 'src/a.ts', lineNumber: 12, lineContent: 'const foo = 1;' }],
        totalMatched: 1,
        totalFiles: 3,
        nextCursor: null,
      },
    });

    const { mockPi, tools } = createMockPi();
    extension(mockPi);

    const result = await tools.get('grep').execute('tool-1', { pattern: 'foo', path: 'src/' });

    expect(finder.grep).toHaveBeenCalledWith(
      'src/ foo',
      expect.objectContaining({ mode: 'plain', smartCase: true, beforeContext: 0, afterContext: 0 })
    );
    expect(result.content[0].text).toContain('src/a.ts:12: const foo = 1;');
  });

  it('grep switches to regex mode when literal is false', async () => {
    finder.grep.mockReturnValue({
      ok: true,
      value: {
        items: [{ relativePath: 'src/a.ts', lineNumber: 1, lineContent: 'foo(bar)' }],
        totalMatched: 1,
        totalFiles: 3,
        nextCursor: null,
      },
    });

    const { mockPi, tools } = createMockPi();
    extension(mockPi);

    await tools.get('grep').execute('tool-1', { pattern: 'foo\\(.+\\)', literal: false });

    expect(finder.grep).toHaveBeenCalledWith(
      'foo\\(.+\\)',
      expect.objectContaining({ mode: 'regex' })
    );
  });

  it('multi_grep delegates patterns and constraints to FileFinder.multiGrep', async () => {
    finder.multiGrep.mockReturnValue({
      ok: true,
      value: {
        items: [{ relativePath: 'src/a.ts', lineNumber: 2, lineContent: 'Alpha Beta' }],
        totalMatched: 1,
        totalFiles: 3,
        nextCursor: null,
      },
    });

    const { mockPi, tools } = createMockPi();
    extension(mockPi);

    const result = await tools.get('multi_grep').execute('tool-1', {
      patterns: ['Alpha', 'Beta'],
      constraints: '*.ts',
    });

    expect(finder.multiGrep).toHaveBeenCalledWith(
      expect.objectContaining({ patterns: ['Alpha', 'Beta'], constraints: '*.ts', smartCase: true })
    );
    expect(result.content[0].text).toContain('src/a.ts:2: Alpha Beta');
  });

  it('fff-health reports finder status through the UI after initialization', async () => {
    const { mockPi, commands, events } = createMockPi();
    extension(mockPi);

    const ctx: any = {
      cwd: '/repo',
      ui: {
        notify: vi.fn(),
        setEditorComponent: vi.fn(),
      },
    };

    await events.get('session_start')?.[0]?.({ type: 'session_start' }, ctx);
    await commands.get('fff-health').handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('FFF v0.5.2'), 'info');
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Picker: 42 files'), 'info');
  });

  it('fff-rescan triggers a fresh scan after initialization', async () => {
    const { mockPi, commands, events } = createMockPi();
    extension(mockPi);

    const ctx: any = {
      cwd: '/repo',
      ui: {
        notify: vi.fn(),
        setEditorComponent: vi.fn(),
      },
    };

    await events.get('session_start')?.[0]?.({ type: 'session_start' }, ctx);
    await commands.get('fff-rescan').handler('', ctx);

    expect(finder.scanFiles).toHaveBeenCalledTimes(1);
    expect(ctx.ui.notify).toHaveBeenCalledWith('FFF rescan triggered', 'info');
  });
});
