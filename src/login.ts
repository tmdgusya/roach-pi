// The TUI's /login: pick a provider and a method, then answer the provider's prompts in overlays.
import { spawn } from "node:child_process";
import type { AuthEvent, AuthType, Models, Provider } from "@earendil-works/pi-ai";
import type { TUI } from "@earendil-works/pi-tui";
import { AUTH_FILE, deviceId } from "./credentials.ts";
import { ask, pick } from "./dialogs.ts";

function openBrowser(url: string): void {
	const [command, args] =
		process.platform === "win32"
			? ["rundll32", ["url.dll,FileProtocolHandler", url]]
			: [process.platform === "darwin" ? "open" : "xdg-open", [url]];
	spawn(command, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

/**
 * Runs one login. `say` shows progress lines (URLs, device codes). Resolves with the provider logged in to, or
 * `undefined` when the user cancelled a picker.
 */
export async function login(
	tui: TUI,
	models: Models,
	say: (line: string) => void,
	signal: AbortSignal,
): Promise<Provider | undefined> {
	const providers = models.getProviders().filter((p) => p.auth.oauth || p.auth.apiKey?.login);
	const providerId = await pick(
		tui,
		"Log in to",
		providers.map((p) => ({ value: p.id, label: p.name, description: p.id })),
		signal,
	);
	const provider = providers.find((p) => p.id === providerId);
	if (!provider) return undefined;

	const methods: { value: AuthType; label: string }[] = [];
	if (provider.auth.oauth) methods.push({ value: "oauth", label: provider.auth.oauth.loginLabel ?? "Sign in (subscription)" });
	if (provider.auth.apiKey?.login) methods.push({ value: "api_key", label: "API key" });
	const type =
		methods.length === 1 ? methods[0]!.value : ((await pick(tui, provider.name, methods, signal)) as AuthType | undefined);
	if (!type) return undefined;

	const notify = (event: AuthEvent) => {
		switch (event.type) {
			case "auth_url":
				say(`Opening ${event.url}`);
				if (event.instructions) say(event.instructions);
				openBrowser(event.url);
				break;
			case "device_code":
				say(`Open ${event.verificationUri} and enter ${event.userCode}`);
				openBrowser(event.verificationUri);
				break;
			default:
				say(event.message);
		}
	};
	await models.login(
		provider.id,
		type,
		{
			signal,
			notify,
			prompt: async (prompt) => {
				// A manual_code prompt's signal aborts when the local callback server got the code first.
				const aborted = AbortSignal.any([signal, ...(prompt.signal ? [prompt.signal] : [])]);
				const answer =
					prompt.type === "select"
						? await pick(
								tui,
								prompt.message,
								prompt.options.map((o) => ({ value: o.id, label: o.label, description: o.description })),
								aborted,
							)
						: await ask(tui, prompt.message, { secret: prompt.type === "secret", signal: aborted });
				if (answer !== undefined) return answer;
				if (prompt.signal?.aborted) return "";
				throw new Error("login cancelled");
			},
		},
		{ getDeviceId: deviceId, agentName: "roach-pi" },
	);
	say(`Logged in to ${provider.name}; saved to ${AUTH_FILE}`);
	return provider;
}
