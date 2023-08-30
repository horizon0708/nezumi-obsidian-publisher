import { pipe } from "fp-ts/lib/function";
import {
	emptyModalContent,
	renderModalDiv,
	renderModalHeader,
	renderModalSetting,
} from "src/shared/obsidian-fp/modal";
import {
	AppContext,
	ModalContext,
	PluginConfigContext,
	PluginContextC,
} from "src/shared/types";
import { RIO } from "src/shared/fp";
import { renderSettingErrorSpan } from "src/shared/obsidian-fp/setting";
import { renderForm } from "./open-edit-modal/render-form";
import { renderSubmitButton } from "./open-edit-modal/render-submit-button";

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

type ModalProps = {
	title: string;
	fields: FormField[];
	onSubmit: () => void;
};

export type OpenEditModalContext = AppContext &
	PluginContextC &
	ModalContext &
	PluginConfigContext;

export const openEditModal = (props: ModalProps) =>
	pipe(
		emptyModalContent(),
		RIO.tap(() => renderModalHeader(props.title)),
		RIO.apSW("formDiv", renderModalDiv()),
		RIO.apSW("hiddenDiv", renderModalDiv()),
		RIO.tapIO((p) => () => p.hiddenDiv.hide()),
		RIO.bindW("submitSetting", () => renderModalSetting),
		RIO.tapIO((ctx) => renderSettingErrorSpan(ctx.submitSetting)),
		RIO.bindW("parentContext", () => RIO.ask<OpenEditModalContext>()),
		RIO.flatMapIO((context) => {
			const { formDiv, hiddenDiv, submitSetting, parentContext } =
				context;
			const deps = {
				formDiv,
				hiddenDiv,
				submitSetting,
				...parentContext,
				onSubmit: props.onSubmit,
			};

			return pipe(
				renderForm(props.fields),
				RIO.tap(renderSubmitButton)
			)(deps);
		})
	);
