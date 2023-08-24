import { App, Modal, Setting, TextComponent, Plugin } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as A from "fp-ts/Array";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { blogModalFormSchema } from "src/settings-new/modal-config";
import { pingBlogFP } from "../io/network";
import { buildPluginConfig } from "src/plugin-config";
import { upsertBlog } from "../io/plugin-data";

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
};

type FormControlContext = {
	controls: FormControl[];
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
	private plugin: Plugin;
	constructor(app: App, plugin: Plugin) {
		super(app);
		this.plugin = plugin;
	}

	render({ title, fields, onSubmit: updateSettingsTab }: ModalViewModel) {
		// clear existing content on rerender
		this.contentEl.empty();

		this.contentEl.createEl("h2", { text: title });

		const formEl = this.contentEl.createEl("form");
		const hiddenEl = this.contentEl.createEl("div");

		// Run the IO computations to render the form controls
		// This returns references to the Form elements to
		const controls = pipe(
			fields,
			A.map(createFormControl),
			RIO.sequenceArray,
			RIO.map((arr) => Array.from(arr))
		)({
			containerEl: formEl,
			hiddenEl,
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

		// Create a container for submit button
		const submitContainer = new Setting(this.contentEl);
		const submitErrorEl = submitContainer.controlEl.createEl("span", {
			text: "controlEl",
			cls: "error-message",
		});
		submitErrorEl.hide();
		submitContainer.addButton((btn) => {
			btn.setButtonText("Save").onClick(async () => {
				const onSubmit = pipe(
					submitForm,
					RTE.mapLeft(formatErrors),
					RTE.tapError(RTE.fromReaderIOK(setErrors)),
					RTE.bindTo("form"),
					RTE.bindW("response", ({ form }) => pingBlogFP(form)),
					// TODO: tapError on the sendForm error to show serverside error
					// transform blog response to SavedBlog
					RTE.map(({ form, response: { blog } }) => ({
						...blog,
						name: form.alias || blog.name,
						apiKey: form.apiKey,
						endpoint: form.endpoint,
						syncFolder: form.syncFolder,
						logs: [],
					})),
					RTE.tap(upsertBlog),
					RTE.tapTask(() => updateSettingsTab),
					RTE.tapIO(() => () => this.close())
				)({
					controls,
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

const formatErrors = (errors: t.Errors) => {
	return errors
		.map((error) =>
			error.context
				.filter(({ key }) => key.length > 0)
				.map(({ key }) => ({ key, msg: error.message }))
		)
		.flat();
};

const setErrors = (errors: FormError[]) =>
	pipe(errors, A.map(setError), RIO.sequenceArray);

const setError =
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

const submitForm = ({ controls, app }: FormControlContext) =>
	pipe(
		controls,
		(e) => {
			console.log(controls);
			return e;
		},
		A.map((e) => {
			console.log(e.text.getValue());
			return e;
		}),
		A.reduce<FormControl, Record<string, string>>({}, (acc, ctrl) => ({
			...acc,
			[ctrl.key]: ctrl.text.getValue(),
		})),
		blogModalFormSchema({ app }).decode,
		TE.fromEither
	);

const createFormControl =
	(field: FormField) =>
	({ containerEl, hiddenEl }: FormRenderContext) =>
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
