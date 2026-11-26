# roach-pi

Rebuild of roach-pi on [`@earendil-works/pi-durable`](https://github.com/earendil-works/pi/tree/main/packages/durable), a durable agent harness: conversations, model turns, and tool calls are committed to storage before they are shown, and an interrupted run resumes after restart.

## Requirements

- Node.js >= 22.19
- `OPENAI_API_KEY`

## Usage

```bash
npm install
npm start -- "What is the capital of France?"
npm run check
```

State lives in `.roach/session.sqlite`; rerunning reopens the same root conversation and resumes unfinished work.
