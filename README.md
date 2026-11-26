# roach-pi

Rebuild of roach-pi on [`@earendil-works/pi-durable`](https://github.com/earendil-works/pi/tree/main/packages/durable), a durable agent harness: conversations, model turns, and tool calls are committed to storage before they are shown, and an interrupted run resumes after restart.

## Requirements

- Node.js >= 22.19
- Credentials for any provider pi-ai supports (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`)

## Usage

```bash
npm install
npm start -- "What is the capital of France?"
npm start -- --model anthropic/claude-sonnet-4-5 "What is the capital of France?"
npm run check
```

`--model <provider>/<modelId>` picks any model from pi-ai's built-in catalog and is stored on the conversation; later runs reuse it until you pass another. Without `--model` on a fresh conversation, the first model whose provider has credentials is used.

State lives in `.roach/session.sqlite`; rerunning reopens the same root conversation and resumes unfinished work.
