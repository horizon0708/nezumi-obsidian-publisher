import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { Blog } from "../io/network";
import { deleteBlog, getBlog, getBlogs } from "../shared/plugin-data";
import { BlogEditModal } from "./edit-modal";
import { blogModalFormFields, buildUpdateFormFields } from "./modal-config";
import { buildPluginConfig } from "src/plugin-config";
import { PluginContext } from "src/commands/types";
import { showErrorNoticeRTE } from "src/shared/notifications";
import BlogSync from "main";
import { LogsModal } from "./logs-modal";

type BlogListContext = {
	containerEl: HTMLElement;
	onEdit: (id: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onAdd: () => void;
	onViewLog: (id: string) => Promise<void>;
};

export class TuhuaSettingTab extends PluginSettingTab {
	plugin: BlogSync;
	constructor(app: App, plugin: BlogSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display() {
		this.containerEl.empty();
		const pluginContext = { app: this.app, plugin: this.plugin };
		const modal = new BlogEditModal(this.app, this.plugin);
		const logModal = new LogsModal(this.app, this.plugin);

		const context: BlogListContext & PluginContext = {
			containerEl: this.containerEl,
			onDelete: async (id) => {
				await pipe(
					deleteBlog(id),
					RTE.tapError(showErrorNoticeRTE),
					RTE.tapIO(() => () => this.display())
				)(pluginContext)();
			},
			onEdit: async (id) => {
				await pipe(
					getBlog(id),
					RTE.map(buildUpdateFormFields),
					RTE.tapIO((fields) => () => {
						modal.render({
							title: "Edit blog",
							fields: fields,
							onSubmit: () => this.display(),
						});
						modal.open();
					}),
					RTE.tapError(showErrorNoticeRTE)
				)(pluginContext)();
			},
			onAdd: () => {
				modal.render({
					title: "Connect new blog",
					fields: blogModalFormFields,
					onSubmit: () => this.display(),
				});
				modal.open();
			},
			onViewLog: async (id) => {
				await logModal.render(id);
				logModal.open();
			},
			...pluginContext,
		};

		await pipe(
			createAddBlogButton,
			RTE.rightReaderIO,
			RTE.chainW(() => getBlogs),
			RTE.tapReaderIO(createBlogItemList)
		)(context)();
	}
}

const createAddBlogButton =
	({ containerEl, onAdd }: BlogListContext) =>
	() => {
		const setting = new Setting(containerEl);
		setting.infoEl.setText("Add a new blog to sync with");
		setting.addButton((btn) => {
			btn.setButtonText("Add new blog").onClick(() => {
				onAdd();
			});
		});
	};

const createBlogItemList = (blogs: Blog[]) => {
	const createBlogItem =
		(blog: Blog) =>
		({ containerEl, onEdit, onDelete, onViewLog }: BlogListContext) =>
		() => {
			const el = new DocumentFragment();
			const anchor = el.createEl("a");
			anchor.href = `https://${blog.subdomain}.${
				buildPluginConfig().domain
			}`;
			anchor.innerText = anchor.href;
			el.appendChild(anchor);

			new Setting(containerEl)
				.setName(blog.name)
				.setDesc(el)
				.addButton((btn) => {
					btn.setButtonText("logs").onClick(async () => {
						await onViewLog(blog.id);
					});
				})
				.addButton((btn) => {
					btn.setIcon("edit").onClick(() => onEdit(blog.id));
				})
				.addButton((btn) => {
					btn.setIcon("trash")
						.setWarning()
						.onClick(async () => {
							await onDelete(blog.id);
						});
				});
		};

	return pipe(blogs, A.map(createBlogItem), RIO.sequenceArray);
};
