import { mkdir } from "node:fs/promises";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { AssistantEntry, createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const context = BACKGROUND_CONTEXT;
const prompt = process.argv.slice(2).join(" ");
if (!prompt) {
	console.error("usage: npm start -- <prompt>");
	process.exit(1);
}

const models = createModels();
models.setProvider(openaiProvider()); // reads OPENAI_API_KEY

await mkdir(".roach", { recursive: true });
const storage = await openNodeSqliteStorage(".roach/session.sqlite");
const harness = await Harness.open(storage, { models, registry: createRegistry() }, context);
try {
	const root = await harness.root(context, { agent: { model: { provider: "openai", modelId: "gpt-6-sol" } } });
	harness.resume();

	const submission = await root.submit({ type: "input", content: prompt }, context);
	const settled = await submission.wait(context);
	if (settled.status === "done" && settled.type === "input") {
		const answer = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
		console.log(answer?.model?.[0]);
	} else {
		console.error("unanswered:", settled);
		process.exitCode = 1;
	}
} finally {
	await harness.close(context);
}
