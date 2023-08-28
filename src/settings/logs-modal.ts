import { pipe } from "fp-ts/lib/function";
import { App, Modal } from "obsidian";
import { Log, getLogsForSession } from "src/shared/plugin-data";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as IO from "fp-ts/IO";
import * as A from "fp-ts/Array";
import BlogSync from "main";

export class LogsModal extends Modal {
	private plugin: BlogSync;
	constructor(app: App, plugin: BlogSync) {
		super(app);
		this.plugin = plugin;
	}

	async render(sessionId: string) {
		this.contentEl.empty();
		this.contentEl.addClass("log-modal");

		const header = this.contentEl.createDiv();
		header.createEl("h2", { text: "Logs" });

		const list = this.contentEl.createDiv();
		list.addClass("log-container");

		return await pipe(
			getLogsForSession(sessionId),
			RTE.chainIOK(renderLog(list))
		)({
			app: this.app,
			plugin: this.plugin,
		})();
	}
}

const renderLog = (listContainer: HTMLDivElement) => (logs: Log[]) => {
	const render = (log: Log) => () => {
		const logContainer = listContainer.createDiv();
		logContainer.addClass("list-item");
		logContainer.createSpan({ text: `${log.timestamp} - ${log.message}` });
	};

	return pipe(logs, A.map(render), IO.sequenceArray);
};
