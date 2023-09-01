import { App, Modal, Setting } from "obsidian";
import { DEFAULT_CONFIG } from "src/shared/plugin-data/plugin-config";
import { submitForm } from "./edit-modal/submit-form";
import BlogSync from "main";
import {
	TextInputField,
	TextInputFieldProps,
} from "./edit-modal/text-input-field";
import {
	FolderSelectField,
	FolderSelectFieldProps,
} from "./edit-modal/folder-select-field";

export type ControlProps = FolderSelectFieldProps | TextInputFieldProps;
export type FormField = { key: string; control: IFormControl };

export interface IFormControl {
	value: string | null;
	setError: (msg: string) => void;
	clearError: () => void;
}

type EditModalProps = {
	title: string;
	fields: ControlProps[];
	hiddenFields: ControlProps[];
	refreshTab: () => void;
};

export class EditModal extends Modal {
	fields: ControlProps[] = [];
	hiddenFields: ControlProps[] = [];
	hiddenEl: HTMLElement | null = null;
	title: string;
	refreshTab: () => void;
	plugin: BlogSync;
	constructor(app: App, plugin: BlogSync, props: EditModalProps) {
		super(app);
		this.title = props.title;
		this.plugin = plugin;
		this.fields = props.fields;
		this.hiddenFields = props.hiddenFields;
		this.refreshTab = props.refreshTab;
	}

	onOpen(): void {
		const header = this.contentEl.createDiv();
		header.createEl("h2", { text: this.title });

		this.hiddenEl = this.contentEl.createDiv();
		const fields = createFields(this.fields, this.app, this.contentEl);
		const hiddenFields = createFields(
			this.hiddenFields,
			this.app,
			this.hiddenEl
		);

		this.hiddenEl.hide();

		const submitSetting = new Setting(this.contentEl);
		const submitErrorEl = submitSetting.controlEl.createEl("span", {
			cls: "error-message",
		});

		submitSetting.addButton((btn) => {
			btn.setButtonText("Submit");
			btn.onClick(async () => {
				clearAllErrors(fields);
				const allFields = [...fields, ...hiddenFields];
				const e = await submitForm(allFields, {
					onSuccess: () => {},
					onError: (e) => {
						submitErrorEl?.setText(e.message);
					},
				})({
					app: this.app,
					plugin: this.plugin,
					pluginConfig: DEFAULT_CONFIG,
				})();
				this.refreshTab();
				this.close();
			});
		});
	}
}

const clearAllErrors = (fields: FormField[]) => {
	fields.forEach((f) => f.control.clearError());
};

const createFields = (
	props: ControlProps[],
	app: App,
	el: HTMLElement
): FormField[] => {
	return props.map((p) => ({
		key: p.key,
		control: createControl(p, app, el),
	}));
};

const createControl = (props: ControlProps, app: App, el: HTMLElement) => {
	if (props.type === "input") {
		return new TextInputField(el, props);
	}
	if (props.type === "folderSuggestion") {
		return new FolderSelectField(app, el, props);
	}
	throw new Error(`Undefined control type`);
};
