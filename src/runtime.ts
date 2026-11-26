import { mkdir } from "node:fs/promises";
import type { Context } from "@earendil-works/chord/context";
import type { Models } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { type Conversation, createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { FileCredentialStore } from "./credentials.ts";

export type Runtime = { harness: Harness; root: Conversation; models: Models };

/**
 * Opens `.roach/session.sqlite` and its root conversation. `model` (`<provider>/<modelId>`) is stored on the
 * conversation; without it, a conversation that has no model gets the first one whose provider has credentials, and
 * stays without one when none has (the TUI's `/login` and `/model` set it).
 */
export async function openRuntime(model: string | undefined, context: Context): Promise<Runtime> {
	// Every built-in provider; credentials come from ~/.roach/auth.json (written by /login), else env API keys.
	const models = builtinModels({ credentials: new FileCredentialStore() });
	await mkdir(".roach", { recursive: true });
	const storage = await openNodeSqliteStorage(".roach/session.sqlite");
	const harness = await Harness.open(storage, { models, registry: createRegistry() }, context);
	try {
		const root = await harness.root(context);
		if (model) {
			const slash = model.indexOf("/");
			if (slash <= 0) throw new Error(`--model must be <provider>/<modelId>, got "${model}"`);
			const ref = { provider: model.slice(0, slash), modelId: model.slice(slash + 1) };
			if (!models.getModel(ref.provider, ref.modelId)) throw new Error(`unknown model: ${model}`);
			await root.configure({ model: ref }, context);
		} else if (!(await root.agent(context)).model) {
			const [first] = await models.getAvailable();
			if (first) await root.configure({ model: { provider: first.provider, modelId: first.id } }, context);
		}
		harness.resume();
		return { harness, root, models };
	} catch (error) {
		await harness.close(context);
		throw error;
	}
}
