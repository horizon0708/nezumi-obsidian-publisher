import {
	App,
	FuzzySuggestModal,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	SuggestModal,
	TAbstractFile,
	TFolder,
} from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { Blog } from "./shared/network";
import { deleteBlog, getBlogById, getBlogs } from "./shared/plugin-data";
import { EditModal } from "./settings/edit-modal";
import { buildPluginConfig } from "src/shared/plugin-config";
import { PluginContextC } from "src/shared/types";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import BlogSync from "main";
import { SessionsModal } from "./settings/sessions-modal";
import {
	buildUpdateFormFields,
	buildUpdateHiddenFormFields,
	editModalFields,
	editModalHiddenFields,
} from "./settings/edit-modal/edit-modal-config";

type BlogListContext = {
	containerEl: HTMLElement;
	onEdit: (id: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onAdd: () => void;
	onViewLog: (id: string) => Promise<void>;
};

export class ExampleModal extends FuzzySuggestModal<TFolder> {
	getItems(): TFolder[] {
		const abstractFiles = app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];

		abstractFiles.forEach((folder: TAbstractFile) => {
			if (folder instanceof TFolder) {
				folders.push(folder);
			}
		});
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path;
	}

	onChooseItem(book: TFolder, evt: MouseEvent | KeyboardEvent) {
		console.log("selected", book);
	}
}

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
			pluginConfig: buildPluginConfig(),
		};

		const sessionsMondal = new SessionsModal(this.app, this.plugin);
		const modal = new Modal(this.app);

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
			onViewLog: async (id) => {
				await sessionsMondal.render(id);
				sessionsMondal.open();
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
					btn.setButtonText("history").onClick(async () => {
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
