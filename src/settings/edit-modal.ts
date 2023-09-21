import { App, Modal, Setting } from "obsidian";
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
import { DEFAULT_CONFIG } from "src/plugin-data/types";

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

		const formEl = this.contentEl.createDiv();
		const hiddenEl = this.contentEl.createDiv();
		const fields = createFields(this.fields, this.app, formEl);
		const hiddenFields = createFields(
			this.hiddenFields,
			this.app,
			hiddenEl
		);

		hiddenEl.hide();

		new Setting(formEl)
			.setName("Show advanced settings")
			.addToggle((toggle) => {
				toggle.setValue(false);
				toggle.onChange((val) => {
					val ? hiddenEl.show() : hiddenEl.hide();
				});
			});

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
					onSuccess: () => {
						this.refreshTab();
						this.close();
					},
					onError: (e) => {
						submitErrorEl?.setText(e.message);
					},
				})({
					app: this.app,
					plugin: this.plugin,
					pluginConfig: DEFAULT_CONFIG,
				})();
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
