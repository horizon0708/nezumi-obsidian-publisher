import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { Blog } from "../io/network";
import { deleteBlog, getBlog, getBlogs } from "../io/plugin-data";
import { BlogEditModal } from "./edit-modal";
import { blogModalFormFields, buildUpdateFormFields } from "./modal-config";
import { buildPluginConfig } from "src/plugin-config";

export class NewSettingTab extends PluginSettingTab {
	plugin: Plugin;
	constructor(app: App, plugin: Plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display() {
		this.containerEl.empty();
		const pluginContext = { app: this.app, plugin: this.plugin };
		const modal = new BlogEditModal(this.app, this.plugin);

		const context: BlogListContext = {
			containerEl: this.containerEl,
			onDelete: async (id) => {
				await deleteBlog(id)(pluginContext)();
				this.display();
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
					})
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
		};

		const res = await getBlogs(pluginContext)();
		if (res._tag === "Left") {
			return;
		}
		pipe(
			[createAddBlogButton, createList(res.right)],
			RIO.sequenceArray
		)(context)();
	}
}

type BlogListContext = {
	containerEl: HTMLElement;
	onEdit: (id: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onAdd: () => void;
};

const createList = (blogs: Blog[]) =>
	pipe(blogs, A.map(createBlogItem), RIO.sequenceArray);

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

const createBlogItem =
	(blog: Blog) =>
	({ containerEl, onEdit, onDelete }: BlogListContext) =>
	() => {
		const el = new DocumentFragment();
		const anchor = el.createEl("a");
		anchor.href = `https://${blog.subdomain}.${buildPluginConfig().domain}`;
		anchor.innerText = anchor.href;
		el.appendChild(anchor);

		new Setting(containerEl)
			.setName(blog.name)
			.setDesc(el)
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
