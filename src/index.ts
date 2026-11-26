import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { AssistantEntry, createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const context = BACKGROUND_CONTEXT;
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { model: { type: "string", short: "m" } },
});
const prompt = positionals.join(" ");
if (!prompt) {
	console.error("usage: npm start -- [--model <provider>/<modelId>] <prompt>");
	process.exit(1);
}

const models = builtinModels(); // every built-in provider; credentials come from env or the credential store

await mkdir(".roach", { recursive: true });
const storage = await openNodeSqliteStorage(".roach/session.sqlite");
const harness = await Harness.open(storage, { models, registry: createRegistry() }, context);
try {
	const root = await harness.root(context);
	if (values.model) {
		const slash = values.model.indexOf("/");
		if (slash <= 0) throw new Error(`--model must be <provider>/<modelId>, got "${values.model}"`);
		const model = { provider: values.model.slice(0, slash), modelId: values.model.slice(slash + 1) };
		if (!models.getModel(model.provider, model.modelId)) throw new Error(`unknown model: ${values.model}`);
		await root.configure({ model }, context);
	} else if (!(await root.agent(context)).model) {
		const [first] = await models.getAvailable();
		if (!first) throw new Error("no provider has credentials; set an API key (e.g. ANTHROPIC_API_KEY) or pass --model");
		await root.configure({ model: { provider: first.provider, modelId: first.id } }, context);
	}
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
