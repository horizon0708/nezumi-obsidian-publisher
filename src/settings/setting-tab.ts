import BlogSync from "main";
import { App, PluginSettingTab, Setting, TFile, normalizePath } from "obsidian";
import { BlogModal } from "./blog-modal";
import { buildPluginConfig } from "../plugin-config";
import { Blog, pingBlogFP } from "../network";

type BlogFieldState = Blog & {
	errorEl: HTMLElement | null;
	message: string;
};

export class SettingTab extends PluginSettingTab {
	plugin: BlogSync;
	blogs: BlogFieldState[] = [];

	constructor(app: App, plugin: BlogSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Blog Publisher for Nezumi" });

		this.addNewBlogModal();

		const heading = containerEl.createEl("h2", {
			text: `Connected Blogs`,
		});
		heading.setAttrs({ style: "text-align: left;" });
		this.connectedBlogs(containerEl);
	}

	private addNewBlogModal = () => {
		const addBlogModal = new BlogModal(
			this.app,
			{
				title: "Add a new connection",
				fields: {
					apiKey: {
						name: "API Key",
						description: "The API key for your blog.",
						value: "",
						initialValue: "",
						setting: null,
						errorEl: null,
						validationCb: this.apiKeyValidation(),
					},
					syncFolder: {
						name: "Folder to publish",
						description: "Set to '/' to publish the entire vault.",
						value: "/",
						initialValue: "/",
						validationCb: this.syncFolderValidation,
						transformCb: this.syncFolderTransform,
					},
					endpoint: {
						value: buildPluginConfig().baseUrl,
						initialValue: buildPluginConfig().baseUrl,
						isHidden: true,
						showRestoreButton: true,
					},
				},
			},
			this.saveBlog
		);

		const setting = new Setting(this.containerEl);
		setting.infoEl.setText("Add a new blog to sync with");

		setting.addButton((btn) => {
			btn.setButtonText("Add new blog").onClick(() => {
				addBlogModal.open();
			});
		});
	};

	private saveBlog = async (values: Record<string, string>) => {
		const { apiKey, syncFolder, endpoint, name: customName } = values;
		const b = await pingBlogFP({
			apiKeyHeader: buildPluginConfig().apiKeyHeader,
			apiKeyValue: apiKey,
			baseUrl: endpoint ?? buildPluginConfig().baseUrl,
		})();
		console.log("---");
		console.log(b);
		console.log("---");
		const pingResponse = await pingBlogFP({ apiKey, endpoint })();
		let message = "";
		if (pingResponse._tag === "Right") {
			const { id, name, subdomain } = pingResponse.right.blog;
			const ind = this.blogs.findIndex((b) => b.id === id);
			const blogParams: BlogFieldState = {
				id,
				name: customName ?? name,
				apiKey,
				syncFolder,
				errorEl: null,
				endpoint,
				message: "",
				subdomain,
			};

			if (ind !== -1) {
				this.blogs[ind] = blogParams;
			} else {
				this.blogs.push(blogParams);
			}

			await this.saveSettings();
			this.display();
		} else {
			// const { status, error } = pingResponse;
			// message = `Error: ${status} ${error}`;
			message = "error getting blog info";
		}
		return message;
	};

	private apiKeyValidation = (currentKey?: string) => (value: string) => {
		let message = "";
		if (!value) {
			message = "Api key cannot be empty";
		}
		if (
			currentKey !== value &&
			this.blogs.map((b) => b.apiKey).some((k) => k === value)
		) {
			message = "Api key already exists";
		}
		return message;
	};

	private syncFolderValidation = (value: string) => {
		const file = this.app.vault.getAbstractFileByPath(value);
		let message = "";
		if (!value) {
			value = "/";
		}
		if (!file) {
			message = "The folder does not exist";
		}
		if (file instanceof TFile) {
			message = "Sync folder cannot be a file";
		}
		return message;
	};

	private syncFolderTransform = (value: string) => {
		return normalizePath(value);
	};

	private connectedBlogs = (el: HTMLElement) => {
		for (let i = 0; i < this.blogs.length; i++) {
			const { name, apiKey, syncFolder, endpoint } = this.blogs[i];
			const blogDiv = this.containerEl.createEl("div");

			const editModal = new BlogModal(
				this.app,
				{
					title: `Edit connection for ${name} `,
					fields: {
						name: {
							value: name,
							initialValue: name,
							validationCb: (name) =>
								name ? "" : "Name cannot be empty",
						},
						apiKey: {
							name: "API Key",
							description: "The API key for your blog.",
							value: apiKey,
							initialValue: apiKey,
							validationCb: this.apiKeyValidation(apiKey),
						},
						syncFolder: {
							name: "Folder to publish",
							description:
								"Must be a valid path to a folder. Set to '/' to publish the entire vault (not recommended).",
							value: syncFolder,
							initialValue: syncFolder,
							transformCb: this.syncFolderTransform,
							validationCb: this.syncFolderValidation,
						},
						endpoint: {
							name: "api endpoint",
							value: endpoint,
							initialValue: endpoint,
							validationCb: () => "",
							isHidden: true,
							showRestoreButton: true,
						},
					},
				},
				this.saveBlog
			);
			const el = new DocumentFragment();
			const anchor = el.createEl("a");
			anchor.href = `https://${this.blogs[i].subdomain}.${
				buildPluginConfig().domain
			}`;
			anchor.innerText = anchor.href;
			el.appendChild(anchor);

			new Setting(blogDiv)
				.setName(name)
				.setDesc(el)
				.addButton((btn) => {
					btn.setIcon("edit").onClick(async () => {
						editModal.open();
					});
				})
				.addButton((btn) => {
					btn.setIcon("trash")
						.setWarning()
						.onClick(async () => {
							btn.setDisabled(true);
							this.blogs.splice(i, 1);
							await this.saveSettings();
							blogDiv.remove();
						});
				});
		}
	};

	loadSettings = async () => {
		const data = await this.plugin.loadData();
		this.blogs = [...data];
	};

	saveSettings = async () => {
		await this.plugin.saveData(this.blogs);
		this.plugin.loadCommands();
		console.log("saved", this.blogs);
	};
}
