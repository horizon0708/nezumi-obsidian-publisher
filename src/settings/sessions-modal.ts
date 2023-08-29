import { pipe } from "fp-ts/lib/function";
import { App, Modal, Setting } from "obsidian";
import {
	Log,
	UploadSession,
	getBlogUploadSessions,
	getLogsForSession,
} from "src/shared/plugin-data";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as IO from "fp-ts/IO";
import * as A from "fp-ts/Array";
import BlogSync from "main";

export class SessionsModal extends Modal {
	private plugin: BlogSync;
	constructor(app: App, plugin: BlogSync) {
		super(app);
		this.plugin = plugin;
	}

	async render(blogId: string) {
		this.contentEl.empty();
		this.contentEl.addClass("session-modal");
		const header = this.contentEl.createDiv();
		header.createEl("h2", { text: "Upload history" });

		const list = this.contentEl.createDiv();
		// list.addClass("log-container");

		return await pipe(
			getBlogUploadSessions(blogId),
			RTE.tapIO(
				renderSessions(list, async (session) => {
					await this.renderLogs(session);
				})
			),
			RTE.tapIO(renderEmptyScreen(list))
		)({
			app: this.app,
			plugin: this.plugin,
		})();
	}

	async renderLogs(session: UploadSession) {
		this.contentEl.empty();
		this.contentEl.addClass("log-modal");

		const header = this.contentEl.createDiv();
		header.createEl("h2", { text: "Session logs" });
		header.addClass("log-header");

		const list = this.contentEl.createDiv();
		list.addClass("log-container");

		return await pipe(
			getLogsForSession(session.id),
			RTE.tapIO(() =>
				renderLogHeader(header, async (blogId) => {
					this.render(blogId);
				})(session)
			),
			RTE.tapIO(renderLog(list))
		)({
			app: this.app,
			plugin: this.plugin,
		})();
	}
}

// NIT: refactor these to use Reader monad
const renderEmptyScreen =
	(listContainer: HTMLDivElement) => (sessions: UploadSession[]) => () => {
		if (sessions.length > 0) return;

		const logContainer = listContainer.createDiv();
		logContainer.addClass("empty-list");
		logContainer.createSpan({
			text: "no upload sessions found",
		});
	};

const renderSessions =
	(
		listContainer: HTMLDivElement,
		onOpen: (sessionId: UploadSession) => Promise<void>
	) =>
	(logs: UploadSession[]) => {
		const render = (session: UploadSession) => () => {
			const logContainer = listContainer.createDiv();

			new Setting(logContainer)
				.setName("Skipped")
				.setDesc(session.startedAt)
				.addButton((btn) => {
					btn.setButtonText("View logs");
					btn.onClick(async () => {
						await onOpen(session);
					});
				});
		};

		return pipe(logs, A.map(render), IO.sequenceArray);
	};

const renderLogHeader =
	(container: HTMLElement, onBack: (blogId: string) => Promise<void>) =>
	(session: UploadSession) =>
	() => {
		new Setting(container)
			.setName("Skipped")
			.setDesc(session.startedAt)
			.addButton((btn) => {
				btn.setButtonText("Go back to sessions");
				btn.onClick(async () => {
					await onBack(session.blogId);
				});
			});
	};

const renderLog = (listContainer: HTMLDivElement) => (logs: Log[]) => {
	const render = (log: Log) => () => {
		const logContainer = listContainer.createDiv();
		logContainer.addClass("list-item");
		logContainer.createSpan({ text: `${log.timestamp} - ${log.message}` });
	};

	return pipe(logs, A.map(render), IO.sequenceArray);
};
