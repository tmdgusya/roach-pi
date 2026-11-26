// Store provider credentials in ~/.roach/auth.json: `npm run login [-- <provider>]`.
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import type { AuthPrompt, AuthType } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { AUTH_FILE, deviceId, FileCredentialStore } from "./credentials.ts";

const models = builtinModels({ credentials: new FileCredentialStore() });
const rl = createInterface({ input: stdin, output: stdout });

async function choose<T>(message: string, options: readonly { label: string; value: T }[]): Promise<T> {
	console.log(`\n${message}`);
	options.forEach((option, index) => console.log(`  ${index + 1}. ${option.label}`));
	const picked = options[Number.parseInt(await rl.question(`Enter number (1-${options.length}): `), 10) - 1];
	if (!picked) throw new Error("invalid selection");
	return picked.value;
}

/** Reads a line without echoing it, for API keys and tokens. */
async function askSecret(message: string): Promise<string> {
	rl.pause();
	stdout.write(`${message}: `);
	stdin.setRawMode(true);
	stdin.resume();
	let value = "";
	try {
		for await (const chunk of stdin) {
			for (const char of String(chunk)) {
				if (char === "\r" || char === "\n") return value;
				if (char === "\u0003") throw new Error("cancelled");
				if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
				else value += char;
			}
		}
		return value;
	} finally {
		stdin.setRawMode(false);
		stdout.write("\n");
		rl.resume();
	}
}

async function answer(prompt: AuthPrompt): Promise<string> {
	const hint = "placeholder" in prompt && prompt.placeholder ? ` (${prompt.placeholder})` : "";
	switch (prompt.type) {
		case "select":
			return choose(
				prompt.message,
				prompt.options.map((option) => ({ label: option.label, value: option.id })),
			);
		case "secret":
			return askSecret(`${prompt.message}${hint}`);
		default:
			// A manual_code prompt is aborted when the local callback server receives the code first.
			try {
				return await rl.question(`${prompt.message}${hint}: `, { signal: prompt.signal });
			} catch (error) {
				if (prompt.signal?.aborted) return "";
				throw error;
			}
	}
}

try {
	const providers = models.getProviders().filter((p) => p.auth.oauth || p.auth.apiKey?.login);
	const requested = process.argv[2];
	const provider = requested
		? providers.find((p) => p.id === requested)
		: await choose(
				"Provider:",
				providers.map((p) => ({ label: `${p.name} (${p.id})`, value: p })),
			);
	if (!provider) throw new Error(`unknown provider or no login flow: ${requested}`);

	const types: { label: string; value: AuthType }[] = [];
	if (provider.auth.oauth) types.push({ label: provider.auth.oauth.loginLabel ?? "Sign in (OAuth)", value: "oauth" });
	if (provider.auth.apiKey?.login) types.push({ label: "API key", value: "api_key" });
	const type = types.length === 1 ? types[0]!.value : await choose("Method:", types);

	await models.login(
		provider.id,
		type,
		{
			prompt: answer,
			notify: (event) => {
				if (event.type === "auth_url") console.log(`\nOpen in your browser:\n${event.url}\n${event.instructions ?? ""}`);
				else if (event.type === "device_code") console.log(`\nOpen ${event.verificationUri} and enter ${event.userCode}`);
				else console.log(event.message);
			},
		},
		{ getDeviceId: deviceId, agentName: "roach-pi" },
	);
	console.log(`\nSaved ${provider.id} credentials to ${AUTH_FILE}`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	rl.close();
}
