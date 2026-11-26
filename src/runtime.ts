import { mkdir } from "node:fs/promises";
import type { Context } from "@earendil-works/chord/context";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { type Conversation, createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

export type Runtime = { harness: Harness; root: Conversation };

/**
 * Opens `.roach/session.sqlite` and its root conversation. `model` (`<provider>/<modelId>`) is stored on the
 * conversation; without it, a conversation that has no model gets the first one whose provider has credentials.
 */
export async function openRuntime(model: string | undefined, context: Context): Promise<Runtime> {
	const models = builtinModels(); // every built-in provider; credentials come from env or the credential store
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
			if (!first) throw new Error("no provider has credentials; set an API key (e.g. ANTHROPIC_API_KEY) or pass --model");
			await root.configure({ model: { provider: first.provider, modelId: first.id } }, context);
		}
		harness.resume();
		return { harness, root };
	} catch (error) {
		await harness.close(context);
		throw error;
	}
}
