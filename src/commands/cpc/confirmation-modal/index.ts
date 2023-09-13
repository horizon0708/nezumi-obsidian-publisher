import { App, MarkdownRenderer, Modal, Setting } from "obsidian";
import BlogSync from "main";

type ModalData = {
	markdown: string;
	onUpload: () => Promise<void>;
};

export class ConfirmationModal extends Modal {
	constructor(app: App, private plugin: BlogSync) {
		super(app);
	}

	render(data: ModalData) {
		const headerEl = this.contentEl.createDiv();
		const mainEl = this.contentEl.createDiv();
		const footerEl = this.contentEl.createDiv();

		this.renderMarkdown(mainEl, data.markdown);

		// render footer
		this.renderFooter(footerEl, data.onUpload, true);
	}

	renderMarkdown(el: HTMLElement, markdown: string) {
		MarkdownRenderer.render(this.app, markdown, el, "", this.plugin);
	}

	renderFooter(
		el: HTMLElement,
		onUpload: () => Promise<void>,
		showUpload?: boolean
	) {
		if (!showUpload) {
			return;
		}

		new Setting(el)
			.addButton((btn) => {
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Upload")
					.onClick(() => {
						onUpload();
						this.close();
					})
					.setCta();
			});
	}
}
