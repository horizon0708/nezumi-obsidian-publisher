import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { Blog } from "../io/network";
import { loadData } from "../io/obsidian-fp";
import { deleteBlog } from "../io/plugin-data";
import { BlogEditModal } from "../io/edit-modal";
import { blogModalFormFields } from "./modal-config";
import { SavedBlog } from "./saved-blog";

export class NewSettingTab extends PluginSettingTab {
	plugin: Plugin;
	constructor(app: App, plugin: Plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display() {
		this.containerEl.empty();
		const pluginContext = { app: this.app, plugin: this.plugin };
		const res = await loadData(pluginContext)();

		if (res._tag === "Left") {
			return;
		}
		console.log(res);
		const blogs = res.right["blogs"];
		const modal = new BlogEditModal(this.app, this.plugin);

		const context: BlogListContext = {
			containerEl: this.containerEl,
			onDelete: async (id) => {
				await deleteBlog(id)(pluginContext)();
				this.display();
			},
			onEdit: (id) => {
				const blog = blogs.find((blog: SavedBlog) => blog.id === id);
				if (!blog) {
					return;
				}
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

		pipe(
			[createAddBlogButton, createBlogItemList(blogs)],
			RIO.sequenceArray
		)(context)();
	}
}

type BlogListContext = {
	containerEl: HTMLElement;
	onEdit: (id: string) => void;
	onDelete: (id: string) => Promise<void>;
	onAdd: () => void;
};

export const createBlogItemList = (blogs: Blog[]) =>
	pipe(
		RIO.Do,
		RIO.bind("container", () =>
			RIO.asks<BlogListContext, HTMLElement>((r) => r.containerEl)
		),
		RIO.apS("items", createList(blogs))
	);

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
		new Setting(containerEl)
			.setName(blog.name)
			.setDesc(blog.subdomain)
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
