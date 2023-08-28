import { App, Modal, Setting, TextComponent, Plugin } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as A from "fp-ts/Array";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as E from "fp-ts/Either";
import * as t from "io-ts";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { blogModalFormSchema } from "src/settings/modal-config";
import { pingBlogFP } from "../shared/network";
import { buildPluginConfig } from "src/plugin-config";
import { upsertBlog } from "../shared/plugin-data";
import { DecodeError } from "src/shared/errors";
import { showNotice } from "src/shared/obsidian-fp";
import BlogSync from "main";

export type FormField = {
	key: string;
	value: string;
	initialValue: string;
	label?: string;
	description?: string;
	errorMsg?: string;
	isHidden: boolean;
	showRestoreButton: boolean;
};

type FormRenderContext = {
	containerEl: HTMLElement;
	hiddenEl: HTMLElement;
	submitErrorEl: HTMLElement;
};

type FormControlContext = {
	controls: FormControl[];
	submitErrorEl: HTMLElement;
	app: App;
};

// Reader IO will do this :sweat_smile:
type FormControl = ReturnType<ReturnType<ReturnType<typeof createFormControl>>>;

type ModalViewModel = {
	title: string;
	fields: FormField[];
	onSubmit: () => Promise<void>;
};

type FormError = { key: string; msg: string | undefined };

export class BlogEditModal extends Modal {
	private plugin: BlogSync;
	constructor(app: App, plugin: BlogSync) {
		super(app);
		this.plugin = plugin;
	}

	render({ title, fields, onSubmit: updateSettingsTab }: ModalViewModel) {
		// clear existing content on rerender
		this.contentEl.empty();

		this.contentEl.createEl("h2", { text: title });

		// Create containers and buttons
		const formEl = this.contentEl.createEl("form");
		const hiddenEl = this.contentEl.createEl("div");
		const submitContainer = new Setting(this.contentEl);
		const submitErrorEl = submitContainer.controlEl.createEl("span", {
			text: "controlEl",
			cls: "error-message",
		});
		submitErrorEl.hide();

		// Run the IO computations to render the form fields
		// This returns references to the Form elements to
		const controls = pipe(
			fields,
			A.map(createFormControl),
			RIO.sequenceArray,
			RIO.map((arr) => Array.from(arr))
		)({
			containerEl: formEl,
			hiddenEl,
			submitErrorEl,
		})();

		// render toggle button to show hidden fields
		new Setting(formEl)
			.setName("Show advanced settings")
			.addToggle((toggle) => {
				const defaultShow = false;
				defaultShow ? hiddenEl.show() : hiddenEl.hide();
				toggle.setValue(false).onChange((val) => {
					val ? hiddenEl.show() : hiddenEl.hide();
				});
			});

		submitContainer.addButton((btn) => {
			btn.setButtonText("Save").onClick(async () => {
				const onSubmit = pipe(
					submitForm,
					RTE.fromReaderEither,
					RTE.tapError(RTE.fromReaderIOK(setFieldErrors)),
					RTE.chainW((form) =>
						pipe(
							pingBlogFP(form),
							RTE.map(({ blog }) => ({
								...blog,
								name: form.alias || blog.name,
								apiKey: form.apiKey,
								endpoint: form.endpoint,
								syncFolder: form.syncFolder,
							}))
						)
					),
					RTE.tap(upsertBlog),
					RTE.tapTask(() => updateSettingsTab),
					RTE.tapError(RTE.fromReaderIOK(setSubmitError)),
					RTE.tapIO(() => () => this.close()),
					RTE.tapIO(
						(blog) => () =>
							showNotice(
								`Successfully connected to ${blog.name}!`
							)
					)
				)({
					controls,
					submitErrorEl,
					app: this.app,
					pluginConfig: buildPluginConfig(),
					plugin: this.plugin,
				});

				const e = await onSubmit();
				console.log(e);
			});
		});
	}
}

const setSubmitError =
	(error: Error) =>
	({ submitErrorEl }: FormControlContext) =>
	() => {
		submitErrorEl.setText(error.message);
		submitErrorEl.show();
	};

const submitForm = ({ controls, app }: FormControlContext) =>
	pipe(
		controls,
		A.reduce<FormControl, Record<string, string>>({}, (acc, ctrl) => ({
			...acc,
			[ctrl.key]: ctrl.text.getValue(),
		})),
		blogModalFormSchema({ app }).decode,
		E.mapLeft((errors) => new DecodeError(errors))
	);

const setFieldErrors = (de: DecodeError) => {
	const transformDecodeErrors = (errors: t.Errors) => {
		return errors
			.map((error) =>
				error.context
					.filter(({ key }) => key.length > 0)
					.map(({ key }) => ({ key, msg: error.message }))
			)
			.flat();
	};

	const setFieldError =
		({ key, msg }: FormError) =>
		({ controls }: FormControlContext) =>
		() =>
			pipe(
				controls,
				A.findFirst((c) => c.key === key),
				O.map((ctrl) => {
					ctrl.error.textContent = msg ?? "";
					ctrl.error.show();
				})
			);

	return pipe(
		de.errors,
		transformDecodeErrors,
		A.map(setFieldError),
		RIO.sequenceArray
	);
};

const createFormControl =
	(field: FormField) =>
	({ containerEl, hiddenEl, submitErrorEl }: FormRenderContext) =>
	() => {
		const {
			value,
			initialValue,
			label,
			description,
			errorMsg,
			showRestoreButton,
			isHidden,
		} = field;
		const setting = new Setting(isHidden ? hiddenEl : containerEl);
		if (label) {
			setting.setName(label);
		}
		if (description) {
			setting.setDesc(description);
		}
		let error = setting.controlEl.createEl("span", {
			cls: "error-message",
		});
		if (errorMsg) {
			error.setText(errorMsg);
			error.show();
		}

		let textComponent: TextComponent | null = null;
		setting.addText((text) => {
			textComponent = text;
			text.setValue(value || initialValue).onChange(() => {
				// when touched, it should remove any error messages
				error.setText("");
				error.hide();
				submitErrorEl.setText("");
				submitErrorEl.hide();
			});
		});
		if (showRestoreButton) {
			setting.addButton((btn) => {
				btn.setIcon("rotate-cw")
					.setTooltip("Restore default")
					.onClick(() => {
						textComponent?.setValue(field.initialValue);
					});
			});
		}

		return {
			key: field.key,
			setting,
			text: textComponent!,
			error,
		};
	};
