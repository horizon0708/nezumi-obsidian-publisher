import { App, PluginSettingTab, Setting } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { EditModal } from "./settings/edit-modal";
import { PluginContextC } from "src/shared/types";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import BlogSync from "main";
import {
	buildUpdateFormFields,
	buildUpdateHiddenFormFields,
	editModalFields,
	editModalHiddenFields,
} from "./settings/edit-modal/edit-modal-config";
import { deleteBlog, getBlogById, getBlogs } from "./plugin-data/blogs";
import { DEFAULT_CONFIG, SavedBlog } from "./plugin-data/types";

type BlogListContext = {
	containerEl: HTMLElement;
	onEdit: (id: number) => Promise<void>;
	onDelete: (id: number) => Promise<void>;
	onAdd: () => void;
};

export class TuhuaSettingTab extends PluginSettingTab {
	plugin: BlogSync;
	constructor(app: App, plugin: BlogSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display() {
		this.containerEl.empty();
		const pluginContext = {
			app: this.app,
			plugin: this.plugin,
			pluginConfig: DEFAULT_CONFIG,
		};

		const context: BlogListContext & PluginContextC = {
			containerEl: this.containerEl,
			onDelete: async (id) => {
				await pipe(
					deleteBlog(id),
					RTE.tapError(showErrorNoticeRTE),
					RTE.tapIO(() => () => this.display())
				)(pluginContext)();
			},
			onEdit: async (id) => {
				const b = await getBlogById(id)({ plugin: this.plugin })();
				if (b._tag === "Right") {
					const editModal = new EditModal(this.app, this.plugin, {
						title: "Edit connection",
						fields: buildUpdateFormFields(b.right),
						hiddenFields: buildUpdateHiddenFormFields(b.right),
						refreshTab: () => this.display(),
					});
					editModal.open();
				}
			},
			onAdd: () => {
				const addModal = new EditModal(this.app, this.plugin, {
					title: "Connect new blog!",
					fields: editModalFields,
					hiddenFields: editModalHiddenFields,
					refreshTab: () => this.display(),
				});
				addModal.open();
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

const createBlogItemList = (blogs: SavedBlog[]) => {
	const createBlogItem =
		(blog: SavedBlog) =>
		({ containerEl, onEdit, onDelete }: BlogListContext) =>
		() => {
			const el = new DocumentFragment();
			const anchor = el.createEl("a");
			anchor.href = `https://${blog.subdomain}.${DEFAULT_CONFIG.domain}`;
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

	return pipe(blogs, A.map(createBlogItem), RIO.sequenceArray);
};
