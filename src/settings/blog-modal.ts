import { App, ButtonComponent, Modal, Setting } from "obsidian";

type FieldState = {
	value: string;
	initialValue: string;
	name?: string;
	description?: string;
	setting?: Setting;
	errorEl?: HTMLElement | null;
	validationCb?: (value: string) => string;
	transformCb?: (value: string) => string;
	isHidden?: boolean;
	showRestoreButton?: boolean;
};

type Form = {
	title: string;
	fields: {
		[key: string]: FieldState;
	};
};

export class BlogModal extends Modal {
	private onSubmit: (formValues: Record<string, string>) => Promise<string>;
	private form: Form;
	private submitButton: ButtonComponent | null = null;
	private submitErrorEl: HTMLElement | null = null;
	private showHidden = false;

	constructor(
		app: App,
		form: Form,
		onSubmit: (formValues: Record<string, string>) => Promise<string>
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.form = form;
		this.resetValues();
	}

	onOpen = () => {
		this.resetValues();
		this.renderForm();
	};

	private resetValues = () => {
		Object.entries(this.form.fields).forEach(([key, value]) => {
			value.value = value.initialValue;
		});
		this.submitButton?.setDisabled(false);
	};
	private renderForm = () => {
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: this.form.title });
		Object.entries(this.form.fields).forEach(([key, value]) => {
			if (!value.isHidden) {
				this.createField(key);
			}
		});
		this.showAdvancedSettingsToggle();
		if (this.showHidden) {
			Object.entries(this.form.fields).forEach(([key, value]) => {
				if (value.isHidden) {
					this.createField(key);
				}
			});
		}

		this.createSubmitButton();
	};

	private showAdvancedSettingsToggle = () => {
		const hasHiddenFields = Object.entries(this.form.fields).some(
			([key, value]) => {
				return value.isHidden;
			}
		);

		if (!hasHiddenFields) {
			return;
		}

		new Setting(this.contentEl)
			.setName("Show advanced settings")
			.addToggle((toggle) => {
				toggle.setValue(this.showHidden).onChange((val) => {
					this.showHidden = val;
					this.renderForm();
				});
			});
	};

	private createField = (key: keyof Form["fields"]) => {
		const field = this.form.fields[key];
		field.setting = new Setting(this.contentEl);
		field.errorEl = field.setting.controlEl.createEl("span", {
			text: "",
			cls: "error-message",
		});

		field.setting.setName(field.name ?? `${key}`);
		field.setting.setDesc(field.description ?? "");

		if (field.showRestoreButton) {
			field.setting.addButton((btn) => {
				btn.setIcon("rotate-cw")
					.setTooltip("Restore default")
					.onClick(() => {
						field.value = field.initialValue;
						this.renderForm();
					});
			});
		}

		field.setting.addText((text) => {
			text.setValue(field.value).onChange((value) => {
				this.onFieldChange(key, value);
				this.submitErrorEl?.hide();
			});
		});
	};

	private onFieldChange = (
		key: keyof Form["fields"],
		value?: string | null
	) => {
		const field = this.form.fields[key];
		const { validationCb, transformCb } = field;
		const message = validationCb?.(value ?? "") ?? "";
		const transformedValue = transformCb?.(value ?? "") ?? value;

		field.value = transformedValue ?? "";

		if (message !== "") {
			field.errorEl?.setText(message);
			field.errorEl?.show();
			this.submitButton?.setDisabled(true);
			return message;
		}

		field.errorEl?.hide();
		this.submitButton?.setDisabled(false);
		return message;
	};

	private createSubmitButton = () => {
		const submitContainer = new Setting(this.contentEl);
		this.submitErrorEl = submitContainer.controlEl.createEl("span", {
			text: "controlEl",
			cls: "error-message",
		});
		this.submitErrorEl.hide();
		submitContainer.addButton((btn) => {
			this.submitButton = btn;
			btn.setButtonText("Save").onClick(this.onSubmitClick);
		});
	};

	private onSubmitClick = async () => {
		try {
			this.submitErrorEl?.hide();
			this.submitButton?.setDisabled(true);
			const validationErrors = [];
			const formValues = Object.entries(this.form.fields).reduce<
				Record<string, string>
			>((acc, [key, field]) => {
				const error = this.onFieldChange(key, field.value);
				if (error !== "") {
					validationErrors.push(error);
				}
				acc[key] = field.value;
				return acc;
			}, {});

			if (validationErrors.length > 0) {
				return;
			}

			const message = await this.onSubmit(formValues);
			this.submitButton?.setDisabled(false);

			if (message === "") {
				this.close();
			} else {
				this.submitErrorEl?.setText(message);
				this.submitErrorEl?.show();
			}
		} catch (e) {
			console.error(e);
			this.submitButton?.setDisabled(false);
		}
	};
}
