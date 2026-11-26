import { parseArgs } from "node:util";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { AssistantEntry } from "@earendil-works/pi-durable";
import { openRuntime } from "./runtime.ts";
import { runTui } from "./tui.ts";

const context = BACKGROUND_CONTEXT;
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { model: { type: "string", short: "m" } },
});
const prompt = positionals.join(" ");
const { harness, root } = await openRuntime(values.model, context);

if (!prompt) {
	await runTui(harness, root, context);
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
