import { App, MarkdownRenderer, Modal, Setting } from "obsidian";
import { Manifest } from "../shared/manifest";
import { PFileWithMd5 } from "../shared/types";
import { A, RIO, pipe } from "src/shared/fp";
import BlogSync from "main";
import { SlugCollisionError } from "src/shared/errors";

type ModalData = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
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

		// render main content
		[
			filesToUploadVm(data.right),
			filesToDeleteVm(data.manifest),
			slugCollisionsVm(data.left),
		]
			.map(renderCalloutBlockMarkdown)
			.forEach((x) => this.renderMarkdown(mainEl, x));

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

type CalloutBlockProps = {
	title: string;
	type: "warning" | "info" | "success" | "error";
	items: string[];
	displayLimit?: number;
	lines: string[];
	show?: boolean;
};

const slugCollisionsVm = (errors: Error[]) => {
	const slugCollisions = errors.filter(
		(x) => x instanceof SlugCollisionError
	) as SlugCollisionError[];

	return {
		type: "warning" as const,
		title: `Following ${slugCollisions.length} file(s) have colliding slugs and are skipped`,
		lines: [
			"You may need to set slugs manually in the frontmatter to resolve the conflicts.",
		],
		items: slugCollisions.map(
			(x) => `${x.file.path} (collising with ${x.message})`
		),
		show: slugCollisions.length > 0,
	};
};

const filesToUploadVm = (files: PFileWithMd5[]) => {
	return {
		type: "success" as const,
		title: `Following ${files.length} file(s) will be uploaded to your blog`,
		lines: [],
		items: files.map((x) => x.file.path),
		show: files.length > 0,
	};
};

const filesToDeleteVm = (manifest: Manifest) => {
	const { posts, assets } = manifest.getItemsToDelete;
	const allItems = [...posts, ...assets];

	return {
		type: "warning" as const,
		title: `Following ${allItems.length} file(s) will be deleted from your blog`,
		lines: [],
		items: allItems.map((x) => x.path).filter((x): x is string => !!x),
		show: allItems.length > 0,
	};
};

const renderCalloutBlockMarkdown = ({
	title,
	type,
	lines,
	items,
	displayLimit,
	show = true,
}: CalloutBlockProps) => {
	if (!show) {
		return "";
	}
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
			...msgs,
			">",
			...lines.map((x) => `> ${x}`),
		],
		(msgs) => msgs.join("\n")
	);
};
