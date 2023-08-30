import { BaseComponent, Setting, TextComponent } from "obsidian";
import { A, IO, O, RIO, pipe } from "src/shared/fp";
import { FormField } from "../edit-modal";
import {
	emptySettingErrorSpan,
	isTextComponent,
} from "src/shared/obsidian-fp/setting";

export type RenderFormContext = {
	formDiv: HTMLElement;
	hiddenDiv: HTMLElement;
	submitSetting: Setting;
	onSubmit: () => void;
};

export const renderForm = (formFields: FormField[]) =>
	pipe(
		formFields,
		A.map(renderFormSetting),
		RIO.sequenceArray,
		RIO.map((a) => [...a])
	);

const renderFormSetting = (field: FormField) =>
	pipe(
		RIO.asks((props: RenderFormContext) =>
			field.isHidden ? props.hiddenDiv : props.formDiv
		),
		RIO.map((el) => ({
			key: field.key,
			setting: new Setting(el),
		})),
		RIO.tap((s) => setFormSettingProps({ inputSetting: s.setting, field }))
	);

type FormProps = { inputSetting: Setting; field: FormField };

const setFormSettingProps =
	({ inputSetting, field }: FormProps) =>
	({ submitSetting }: RenderFormContext) =>
	() => {
		const {
			label,
			description,
			errorMsg,
			value,
			initialValue,
			showRestoreButton,
		} = field;
		if (label) {
			inputSetting.setName(label);
		}
		if (description) {
			inputSetting.setDesc(description);
		}
		inputSetting.controlEl
			.createEl("span", {
				cls: "error-message",
			})
			.setText(errorMsg ?? "");
		// I have a feeling this won't work. getter needs to be lazy
		if (showRestoreButton) {
			inputSetting.addButton((btn) => {
				btn.setIcon("rotate-cw")
					.setTooltip("Restore default")
					.onClick(() => {
						setTextValue({ inputSetting, field })();
					});
			});
		}

		inputSetting.addText((text) => {
			text.setValue(value || initialValue).onChange(() => {
				// when touched, it should remove any error messages
				pipe(
					[inputSetting, submitSetting],
					A.map(emptySettingErrorSpan),
					IO.sequenceArray
				)();
			});
		});
	};

const setTextValue = ({ inputSetting, field }: FormProps) =>
	pipe(
		inputSetting.components,
		A.findFirst(isTextComponent),
		O.map((textComponent) => () => {
			textComponent.setValue(field.initialValue);
		}),
		O.getOrElse(() => () => {})
	);
