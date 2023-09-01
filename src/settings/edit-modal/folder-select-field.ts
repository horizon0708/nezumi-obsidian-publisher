import {
	Setting,
	App,
	FuzzySuggestModal,
	TAbstractFile,
	TFolder,
} from "obsidian";
import { IFormControl } from "../edit-modal";

export type FolderSelectFieldProps = {
	key: string;
	name: string;
	value?: string | null;
	description?: string;
	defaultValue?: string;
	type: "folderSuggestion";
	buttonText: string;
};

export class FolderSelectField implements IFormControl {
	setting: Setting;
	value: string | null = null;
	key: string = "syncFolder";
	app: App;

	private errorSpan: HTMLSpanElement;

	constructor(app: App, el: HTMLElement, props: FolderSelectFieldProps) {
		this.app = app;
		this.setting = new Setting(el);
		this.value = props.value ?? props.defaultValue ?? null;
		this.errorSpan = this.setting.controlEl.createEl("span", {
			cls: "error-message",
		});

		this.setting.setName(props.name).setDesc(props.description ?? "");
		this.setting.addButton((btn) => {
			btn.setButtonText(this.value || props.buttonText);
			btn.onClick((evt) => {
				new FolderSuggestModal(this.app, (folder) => {
					this.value = folder.path;
					this.clearError();
					btn.setButtonText(folder.path);
				}).open();
			});
		});
	}

	setError(msg: string) {
		this.errorSpan.setText(msg);
	}

	clearError() {
		this.errorSpan.setText("");
	}
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	onChooseItemCb: (folder: TFolder) => void;

	constructor(app: App, onChooseItemCb: (folder: TFolder) => void) {
		super(app);
		this.onChooseItemCb = onChooseItemCb;
	}

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

	onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent) {
		this.onChooseItemCb(folder);
	}
}
