import { parseArgs } from "node:util";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { AssistantEntry } from "@earendil-works/pi-durable";
import { openRuntime, type Runtime } from "./runtime.ts";
import { runTui } from "./tui.ts";

const context = BACKGROUND_CONTEXT;
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { model: { type: "string", short: "m" } },
});
const prompt = positionals.join(" ");
let runtime: Runtime;
try {
	runtime = await openRuntime(values.model, context);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
const { harness, root } = runtime;

if (!prompt) {
	await runTui(runtime, context);
} else if (!(await root.agent(context)).model) {
	console.error("no model: run `npm start` and use /login, or set an API key (e.g. ANTHROPIC_API_KEY)");
	await harness.close(context);
	process.exitCode = 1;
} else {
	// Print mode: answer one prompt and exit.
	try {
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
}
