// Modal overlays for TUI flows such as /login and /model: a filterable picker and a (masked) text prompt.
import { styleText } from "node:util";
import {
	type Component,
	CURSOR_MARKER,
	decodeKittyPrintable,
	type Focusable,
	Input,
	matchesKey,
	type SelectItem,
	SelectList,
	type SelectListTheme,
	type TUI,
	truncateToWidth,
} from "@earendil-works/pi-tui";

export const selectListTheme: SelectListTheme = {
	selectedPrefix: (text) => styleText("cyan", text),
	selectedText: (text) => styleText("cyan", text),
	description: (text) => styleText("dim", text),
	scrollInfo: (text) => styleText("dim", text),
	noMatch: (text) => styleText("dim", text),
};

/** A titled list with a type-to-filter line; the filter matches label, value, and description as a substring. */
class FilterSelect implements Component, Focusable {
	#filter = new Input({ prompt: "filter: " });
	#list: SelectList;
	#focused = false;

	readonly heading: string;
	readonly items: readonly SelectItem[];
	readonly onDone: (value: string | undefined) => void;

	constructor(heading: string, items: readonly SelectItem[], onDone: (value: string | undefined) => void) {
		this.heading = heading;
		this.items = items;
		this.onDone = onDone;
		this.#list = this.#build(items);
	}

	get focused(): boolean {
		return this.#focused;
	}
	set focused(value: boolean) {
		this.#focused = value;
		this.#filter.focused = value;
	}

	#build(items: readonly SelectItem[]): SelectList {
		const list = new SelectList([...items], 12, selectListTheme);
		list.onSelect = (item) => this.onDone(item.value);
		list.onCancel = () => this.onDone(undefined);
		return list;
	}

	handleInput(data: string): void {
		if (["up", "down", "pageUp", "pageDown", "enter", "escape"].some((key) => matchesKey(data, key as "up"))) {
			this.#list.handleInput(data);
			return;
		}
		const before = this.#filter.getValue();
		this.#filter.handleInput(data);
		const query = this.#filter.getValue().toLowerCase();
		if (query === before.toLowerCase()) return;
		this.#list = this.#build(
			this.items.filter((item) =>
				`${item.label} ${item.value} ${item.description ?? ""}`.toLowerCase().includes(query),
			),
		);
	}

	render(width: number): string[] {
		return [
			truncateToWidth(styleText("bold", this.heading), width),
			...this.#filter.render(width),
			...this.#list.render(width),
			styleText("dim", "─".repeat(width)),
		];
	}

	invalidate(): void {
		this.#filter.invalidate();
		this.#list.invalidate();
	}
}

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/** One-line text prompt. A secret prompt shows dots and never renders its value. */
class TextPrompt implements Component, Focusable {
	focused = false;
	#input = new Input();
	#secret: string[] = [];
	#pasting = false;

	readonly heading: string;
	readonly secret: boolean;
	readonly onDone: (value: string | undefined) => void;

	constructor(heading: string, secret: boolean, onDone: (value: string | undefined) => void) {
		this.heading = heading;
		this.secret = secret;
		this.onDone = onDone;
		this.#input.onSubmit = (value) => onDone(value);
		this.#input.onEscape = () => onDone(undefined);
	}

	#add(text: string): void {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: secrets are one printable line
		this.#secret.push(...text.replace(/[\x00-\x1f\x7f-\x9f]/g, ""));
	}

	handleInput(data: string): void {
		if (!this.secret) {
			this.#input.focused = this.focused;
			this.#input.handleInput(data);
			return;
		}
		if (data.includes(PASTE_START)) {
			this.#pasting = true;
			data = data.replace(PASTE_START, "");
		}
		if (this.#pasting) {
			const end = data.indexOf(PASTE_END);
			this.#add(end === -1 ? data : data.slice(0, end));
			if (end !== -1) this.#pasting = false;
			return;
		}
		if (matchesKey(data, "enter")) {
			const value = this.#secret.join("");
			this.#secret = [];
			this.onDone(value);
		} else if (matchesKey(data, "escape")) this.onDone(undefined);
		else if (matchesKey(data, "backspace")) this.#secret.pop();
		else {
			// biome-ignore lint/suspicious/noControlCharactersInRegex: plain printable input only
			const printable = decodeKittyPrintable(data) ?? (data && !/[\x00-\x1f\x7f]/.test(data) ? data : undefined);
			if (printable) this.#add(printable);
		}
	}

	render(width: number): string[] {
		let line: string[];
		if (this.secret) {
			const dots = "•".repeat(Math.min(this.#secret.length, Math.max(0, width - 4)));
			line = [truncateToWidth(`> ${dots}${this.focused ? `${CURSOR_MARKER}\x1b[7m \x1b[27m` : ""}`, width)];
		} else {
			this.#input.focused = this.focused;
			line = [...this.#input.render(width)];
		}
		return [
			truncateToWidth(styleText("bold", this.heading), width),
			...line,
			styleText("dim", "enter to confirm · esc to cancel"),
			styleText("dim", "─".repeat(width)),
		];
	}

	invalidate(): void {
		this.#input.invalidate();
	}
}

/** Shows `component` as an overlay until `done` settles, or `signal` aborts (resolving `undefined`). */
function modal<T>(
	tui: TUI,
	create: (done: (value: T | undefined) => void) => Component,
	signal?: AbortSignal,
): Promise<T | undefined> {
	const { promise, resolve } = Promise.withResolvers<T | undefined>();
	const handle = tui.showOverlay(
		create((value) => resolve(value)),
		{ anchor: "bottom-center", width: "100%", maxHeight: "80%" },
	);
	signal?.addEventListener("abort", () => resolve(undefined), { once: true });
	return promise.finally(() => {
		handle.hide();
		tui.requestRender();
	});
}

export function pick(tui: TUI, heading: string, items: readonly SelectItem[], signal?: AbortSignal) {
	return modal<string>(tui, (done) => new FilterSelect(heading, items, done), signal);
}

export function ask(tui: TUI, heading: string, options: { secret?: boolean; signal?: AbortSignal } = {}) {
	return modal<string>(tui, (done) => new TextPrompt(heading, options.secret ?? false, done), options.signal);
}
