import { styleText } from "node:util";
import type { Context } from "@earendil-works/chord/context";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import type {
	Conversation,
	ConversationView,
	EntryId,
	EntryRecord,
	Harness,
	LiveState,
} from "@earendil-works/pi-durable";
import {
	type Component,
	Container,
	Editor,
	type EditorTheme,
	Markdown,
	type MarkdownTheme,
	matchesKey,
	ProcessTerminal,
	Text,
	TuiMainScreen,
} from "@earendil-works/pi-tui";

type Style = Parameters<typeof styleText>[0];
const style =
	(format: Style) =>
	(text: string): string =>
		styleText(format, text);
const dim = style("dim");
const error = style("red");

const markdownTheme: MarkdownTheme = {
	heading: style(["bold", "cyan"]),
	link: style("blue"),
	linkUrl: dim,
	code: style("yellow"),
	codeBlock: (text) => text,
	codeBlockBorder: dim,
	quote: style("italic"),
	quoteBorder: dim,
	hr: dim,
	listBullet: style("cyan"),
	bold: style("bold"),
	italic: style("italic"),
	strikethrough: style("strikethrough"),
	underline: style("underline"),
};
const editorTheme: EditorTheme = {
	borderColor: dim,
	selectList: {
		selectedPrefix: style("cyan"),
		selectedText: style("cyan"),
		description: dim,
		scrollInfo: dim,
		noMatch: dim,
	},
};

const oneLine = (text: string, max = 120): string => {
	const line = text.replace(/\s+/g, " ").trim();
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

/** Components for one assistant message: thinking, text, and tool calls in content order. */
function assistantComponents(message: Pick<AssistantMessage, "content">): Component[] {
	const parts: Component[] = [];
	for (const part of message.content) {
		if (part.type === "text" && part.text.trim()) parts.push(new Markdown(part.text, 1, 0, markdownTheme));
		else if (part.type === "thinking" && part.thinking.trim()) parts.push(new Text(dim(part.thinking), 1, 0));
		else if (part.type === "toolCall")
			parts.push(new Text(dim(`→ ${part.name} ${oneLine(JSON.stringify(part.arguments), 100)}`), 1, 0));
	}
	return parts;
}

function messageComponents(message: Message): Component[] {
	switch (message.role) {
		case "user": {
			const text =
				typeof message.content === "string"
					? message.content
					: message.content.map((part) => (part.type === "text" ? part.text : "[image]")).join("");
			return [new Text(styleText(["bold", "green"], `› ${text}`), 1, 0)];
		}
		case "assistant":
			return assistantComponents(message);
		case "toolResult": {
			const text = message.content.map((part) => (part.type === "text" ? part.text : "[image]")).join("");
			const line = `← ${message.toolName}: ${oneLine(text)}`;
			return [new Text(message.isError ? error(line) : dim(line), 1, 0)];
		}
		default:
			return [];
	}
}

function entryComponents(entry: EntryRecord): Component[] {
	if (entry.kind === "pi.reset") return [new Text(dim("— context reset —"), 1, 0)];
	if (entry.kind === "pi.system") return [];
	return (entry.model ?? []).flatMap(messageComponents);
}

/**
 * Interactive chat over the root conversation. Everything shown comes from `root.watch()`: committed entries are
 * appended once, and `pi.live` (streamed partial answer, tool round, last run failure) is redrawn on each commit.
 * Resolves after the user quits (Ctrl+C or Ctrl+D) and the Harness is closed.
 */
export async function runTui(harness: Harness, root: Conversation, context: Context): Promise<void> {
	const agent = await root.agent(context);
	const modelName = agent.model ? `${agent.model.provider}/${agent.model.modelId}` : "no model";

	const tui = new TuiMainScreen(new ProcessTerminal());
	const transcript = new Container();
	const live = new Container();
	const status = new Text("", 1, 0);
	const editor = new Editor(tui, editorTheme, { paddingX: 1 });
	tui.addChild(transcript);
	tui.addChild(live);
	tui.addChild(editor);
	tui.addChild(status);
	tui.setFocus(editor);

	const shown = new Set<EntryId>();
	let busy = false;
	let notice: string | undefined;

	const showStatus = () => {
		const parts = [modelName, busy ? "working… (esc to abort)" : "enter to send · ctrl+c to quit"];
		if (notice) parts.push(notice);
		status.setText(dim(parts.join(" · ")));
	};

	const render = (view: ConversationView) => {
		if (shown.size === 0 && view.before !== undefined) transcript.addChild(new Text(dim("… earlier messages"), 1, 0));
		for (const entry of view.entries) {
			if (shown.has(entry.id)) continue;
			shown.add(entry.id);
			for (const component of entryComponents(entry)) transcript.addChild(component);
		}

		const state = view.docs["pi.live"] as LiveState | undefined;
		busy = state?.run !== undefined;
		live.clear();
		const generation = state?.generation;
		if (generation?.message) for (const c of assistantComponents(generation.message)) live.addChild(c);
		if (generation?.retry) live.addChild(new Text(error(`retrying: ${oneLine(generation.retry.error)}`), 1, 0));
		for (const slot of state?.tools ?? []) {
			const output = slot.output ? ` ${oneLine(slot.output.split("\n").at(-1) ?? "", 80)}` : "";
			live.addChild(new Text(dim(`⋯ ${slot.name} [${slot.status}]${output}`), 1, 0));
		}
		if (!busy && state?.runFailure) {
			const { reason, detail } = state.runFailure;
			live.addChild(new Text(error(`✗ ${reason}${detail ? `: ${oneLine(detail, 300)}` : ""}`), 1, 0));
		}
		showStatus();
		tui.requestRender();
	};

	const watch = await root.watch(context);
	render(watch.value);
	watch.start(async (call) => {
		if (call.kind === "value") render(call.value);
	});

	const { promise: quit, resolve: exit } = Promise.withResolvers<void>();
	const report = (err: unknown) => {
		notice = error(err instanceof Error ? err.message : String(err));
		showStatus();
		tui.requestRender();
	};

	editor.onSubmit = (text) => {
		const content = text.trim();
		if (!content) return;
		editor.addToHistory(content);
		editor.setText("");
		notice = undefined;
		root.submit({ type: "input", content }, context).catch(report);
	};
	tui.addInputListener((data) => {
		if (matchesKey(data, "ctrl+c") || (matchesKey(data, "ctrl+d") && !editor.getText())) {
			exit();
			return { consume: true };
		}
		if (matchesKey(data, "escape") && busy) {
			root.abort(context).catch(report);
			return { consume: true };
		}
		return undefined;
	});

	tui.start();
	try {
		await quit;
	} finally {
		await watch.stop();
		tui.stop();
		await harness.close(context);
	}
}
