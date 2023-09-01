import { Setting } from "obsidian";
import { IFormControl } from "../edit-modal";

export type TextInputFieldProps = {
	key: string;
	name: string;
	value?: string | null;
	description?: string;
	defaultValue?: string;
	type: "input";
	showRestoreButton?: boolean;
};

export class TextInputField implements IFormControl {
	setting: Setting;
	value: string = "";

	private errorSpan: HTMLSpanElement;

	constructor(el: HTMLElement, props: TextInputFieldProps) {
		this.setting = new Setting(el);
		this.value = props.value ?? props.defaultValue ?? "";

		const { name, description } = props;

		this.errorSpan = this.setting.controlEl.createEl("span", {
			cls: "error-message",
		});

		this.setting.setName(name).setDesc(description ?? "");
		this.setting.addText((text) => {
			text.setValue(this.value);
			text.onChange((value) => {
				this.value = value;
				this.clearError();
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
