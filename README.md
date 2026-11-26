# roach-pi

Rebuild of roach-pi on [`@earendil-works/pi-durable`](https://github.com/earendil-works/pi/tree/main/packages/durable), a durable agent harness: conversations, model turns, and tool calls are committed to storage before they are shown, and an interrupted run resumes after restart.

## Requirements

- Node.js >= 22.19
- Credentials for any provider pi-ai supports (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`)

## Usage

```bash
npm install
npm start                                         # interactive TUI
npm start -- --model anthropic/claude-sonnet-4-5  # TUI with a chosen model
npm start -- "What is the capital of France?"     # print mode: answer one prompt and exit
npm run check
```

The TUI ([`@earendil-works/pi-tui`](https://github.com/earendil-works/pi/tree/main/packages/tui)) renders only committed state from `root.watch()`: transcript entries, the streamed partial answer, the running tool round, and why the last run failed. Enter sends, Esc aborts the running answer, Ctrl+C (or Ctrl+D on an empty editor) quits. Input sent while an answer runs is queued.

`--model <provider>/<modelId>` picks any model from pi-ai's built-in catalog and is stored on the conversation; later runs reuse it until you pass another. Without `--model` on a fresh conversation, the first model whose provider has credentials is used.

State lives in `.roach/session.sqlite`; rerunning reopens the same root conversation and resumes unfinished work.
