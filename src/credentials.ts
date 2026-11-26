import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";

const DIR = join(homedir(), ".roach");
export const AUTH_FILE = join(DIR, "auth.json");
const DEVICE_ID_FILE = join(DIR, "device-id");

type AuthFile = Record<string, Credential>;

function load(): AuthFile {
	try {
		return JSON.parse(readFileSync(AUTH_FILE, "utf-8")) as AuthFile;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		throw error;
	}
}

function save(auth: AuthFile): void {
	mkdirSync(DIR, { recursive: true });
	writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { encoding: "utf-8", mode: 0o600 });
}

/**
 * Credentials in `~/.roach/auth.json`, shared by every project. Writes are serialized within this process only: two
 * roach processes refreshing the same OAuth token at once can race.
 */
export class FileCredentialStore implements CredentialStore {
	#queue: Promise<unknown> = Promise.resolve();

	#serial<T>(task: () => Promise<T>): Promise<T> {
		const run = this.#queue.then(task);
		this.#queue = run.catch(() => {});
		return run;
	}

	async read(providerId: string): Promise<Credential | undefined> {
		return load()[providerId];
	}

	async list(): Promise<readonly CredentialInfo[]> {
		return Object.entries(load()).map(([providerId, credential]) => ({ providerId, type: credential.type }));
	}

	modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined> {
		return this.#serial(async () => {
			const auth = load();
			const next = await fn(auth[providerId]);
			if (next === undefined) return auth[providerId];
			auth[providerId] = next;
			save(auth);
			return next;
		});
	}

	delete(providerId: string): Promise<void> {
		return this.#serial(async () => {
			const auth = load();
			delete auth[providerId];
			save(auth);
		});
	}
}

/** Stable installation ID that OAuth flows send to some providers (e.g. OpenAI's agent host ID). */
export function deviceId(): string {
	try {
		return readFileSync(DEVICE_ID_FILE, "utf-8").trim();
	} catch {
		const id = randomUUID();
		mkdirSync(DIR, { recursive: true });
		writeFileSync(DEVICE_ID_FILE, id);
		return id;
	}
}
