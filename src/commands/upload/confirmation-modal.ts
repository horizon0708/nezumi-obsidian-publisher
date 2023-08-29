import BlogSync from "main";
import { App, ButtonComponent, Modal, Setting } from "obsidian";
import { UploadPlan } from "./plan-upload";
import { BaseContext, BlogContext, PluginContext } from "src/shared/types";
import { pushChanges } from "../upload";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";

export class ConfirmationModal extends Modal {
	isOpen = false;
	baseContext: BaseContext & PluginContext;

	constructor(baseContext: BaseContext & PluginContext) {
		super(baseContext.app);
		this.baseContext = baseContext;
	}

	render(uploadPlan: UploadPlan) {
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
					await uploadAndClose(uploadPlan, () => this.close())(
						this.baseContext
					)();
				});
			});

		this.contentEl.onkeydown = async (e) => {
			if (this.isOpen && e.key === "Enter") {
				console.log("yes");
				await uploadAndClose(uploadPlan, () => this.close())(
					this.baseContext
				)();
			}
		};
	}
	// don't think this matters but just in case!
	onOpen() {
		this.isOpen = true;
	}

	onClose(): void {
		this.isOpen = false;
	}
}

const uploadAndClose = (uploadPlan: UploadPlan, onClose: () => void) =>
	pipe(
		pushChanges(uploadPlan),
		RTE.fold(
			() => RT.of(undefined),
			() => RT.of(undefined)
		),
		RT.tapIO(() => onClose)
	);
