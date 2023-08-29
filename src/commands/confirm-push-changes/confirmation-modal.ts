import { Modal, Setting } from "obsidian";
import { UploadPlan } from "./plan-upload";
import { BaseContext, PluginContext } from "src/shared/types";
import * as RT from "fp-ts/ReaderTask";

type PushChange = (
	plan: UploadPlan
) => RT.ReaderTask<BaseContext & PluginContext, void>;

export class ConfirmationModal extends Modal {
	baseContext: BaseContext & PluginContext;

	constructor(baseContext: BaseContext & PluginContext) {
		super(baseContext.app);
		this.baseContext = baseContext;
	}

	render(uploadPlan: UploadPlan, pushChanges: PushChange) {
		console.log(uploadPlan);
		this.contentEl.empty();
		const header = this.contentEl.createDiv();
		header.createEl("h2", { text: "Upload confirmation" });

		const messageDiv = this.contentEl.createDiv();

		messageDiv.createSpan({
			text: `Upload ${uploadPlan.toUpload.length} files?`,
		});

		new Setting(messageDiv)
			.addButton((btn) => {
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Upload").onClick(async () => {
					try {
						await pushChanges(uploadPlan)(this.baseContext)();
					} catch (e) {
						console.error(e);
					} finally {
						this.close();
					}
				});
			});
	}
}
