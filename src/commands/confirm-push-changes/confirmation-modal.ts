import { MarkdownRenderer, Modal, Setting } from "obsidian";
import { UploadPlan, planUpload } from "./plan-upload";
import { BaseContext, FileStatus, Item, PluginContext } from "src/shared/types";
import * as RT from "fp-ts/ReaderTask";
import * as RIO from "fp-ts/ReaderIO";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { renderMarkdown } from "src/shared/obsidian-fp";

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
		this.contentEl.empty();
		const header = this.contentEl.createDiv();
		header.createEl("h2", { text: "Upload confirmation" });

		const messageDiv = this.contentEl.createDiv();

		const allFileCount =
			uploadPlan.toUpload.length +
			uploadPlan.toSkip.length +
			uploadPlan.errors.length +
			uploadPlan.toDelete.length;

		messageDiv.createSpan({
			text: `${allFileCount} file(s) have been checked for changes`,
		});

		pipe(
			{
				element: messageDiv,
				uploadPlan,
			},
			RIO.of,
			RIO.tap(renderPushInfo),
			RIO.tap(renderDeleteInfo),
			RIO.tap(renderWarningInfo),
			RIO.tap(renderErrorInfo)
		)(this.baseContext)();

		new Setting(messageDiv)
			.addButton((btn) => {
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Upload")
					.onClick(async () => {
						try {
							await pushChanges(uploadPlan)(this.baseContext)();
						} catch (e) {
							console.error(e);
						} finally {
							this.close();
						}
					})
					.setCta();
			});
	}
}

type RenderCalloutArgs = { element: HTMLElement; uploadPlan: UploadPlan };
const renderPushInfo = ({ element, uploadPlan: plan }: RenderCalloutArgs) =>
	pipe(
		plan,
		(plan) =>
			renderCalloutBlockMarkdown({
				type: "success",
				title: `Following ${plan.toUpload.length} file(s) will be uploaded to your blog`,
				lines: [],
				items: plan.toUpload.map((x) => x.file.path),
			}),
		renderMarkdown(element.createDiv())
	);

const renderWarningInfo = ({ element, uploadPlan: plan }: RenderCalloutArgs) =>
	pipe(
		plan.toSkip,
		A.partition((item) => item.status === FileStatus.SLUG_COLLISION),
		({ right }) => right,
		(items) =>
			renderCalloutBlockMarkdown({
				type: "warning",
				title: `Following ${items.length} file(s) have colliding slugs and will be skipped`,
				lines: [
					"You may need to set slugs manually in the frontmatter",
				],
				items: items.map((x) => x.file.path),
			}),
		renderMarkdown(element.createDiv())
	);

const renderDeleteInfo = ({ element, uploadPlan: plan }: RenderCalloutArgs) =>
	pipe(
		plan,
		(plan) =>
			renderCalloutBlockMarkdown({
				type: "info",
				title: `Following ${plan.toDelete.length} file(s) will be deleted from your blog`,
				lines: [
					"These files will be deleted from the server. This plugin will never modify your local files.",
				],
				items: plan.toDelete,
			}),
		renderMarkdown(element.createDiv())
	);

const renderErrorInfo = ({ element, uploadPlan: plan }: RenderCalloutArgs) =>
	pipe(
		plan,
		(plan) =>
			renderCalloutBlockMarkdown({
				type: "error",
				title: `Following ${plan.toDelete.length} file(s) errored out while processing`,
				lines: [
					"This shouldn't normally happen. Please make sure the files are readable and try again.",
				],
				items: plan.toDelete,
			}),
		renderMarkdown(element.createDiv())
	);

type CalloutBlockProps = {
	title: string;
	type: "warning" | "info" | "success" | "error";
	items: string[];
	displayLimit?: number;
	lines: string[];
};

const renderCalloutBlockMarkdown = ({
	title,
	type,
	lines,
	items,
	displayLimit,
}: CalloutBlockProps) => {
	return pipe(
		items,
		A.takeLeft(displayLimit ?? 5),
		A.map((line) => `> - ${line}`),
		(msgs) =>
			msgs.length < items.length
				? [...msgs, `> - and ${items.length - msgs.length} more`]
				: msgs,
		(msgs) => [
			`> [!${type}] ${title}`,
			...lines.map((x) => `> ${x}`),
			...msgs,
		],
		(msgs) => msgs.join("\n")
	);
};
