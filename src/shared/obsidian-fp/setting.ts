import { BaseComponent, Setting, TextComponent } from "obsidian";
import { O, pipe } from "../fp";

const errorCls = "error-message";

export const renderSettingErrorSpan = (setting: Setting) => () => {
	setting.controlEl
		.createEl("span", {
			cls: errorCls,
		})
		.setText("");
};

const getSettingErrorSpan = (setting: Setting) =>
	pipe(
		setting.controlEl.getElementsByClassName(errorCls),
		(e) => e.item(0),
		O.fromNullable
	);

export const setSettingErrorSpan = (setting: Setting) => (msg: string) => () =>
	pipe(
		getSettingErrorSpan(setting),
		O.map((e) => () => e.setText(msg)),
		O.getOrElse(() => () => {})
	);

export const emptySettingErrorSpan = (setting: Setting) =>
	pipe(
		setting,
		getSettingErrorSpan,
		O.map((e) => () => e.setText("")),
		O.getOrElse(() => () => {})
	);

export const isTextComponent = (b: BaseComponent): b is TextComponent =>
	b instanceof TextComponent;
