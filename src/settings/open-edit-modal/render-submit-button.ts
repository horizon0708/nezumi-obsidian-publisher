import { pipe } from "fp-ts/lib/function";
import { A, IO, O, RE, RIO, RTE, t } from "src/shared/fp";
import { PluginContext, AppContext, ModalContext } from "src/shared/types";
import { RenderFormContext } from "./render-form";
import { Setting } from "obsidian";
import { DecodeError } from "src/shared/errors";
import { pingBlogFP } from "src/shared/network";
import { closeModal } from "src/shared/obsidian-fp/modal";
import { upsertBlog } from "src/shared/plugin-data";
import { blogModalFormSchema } from "./modal-config";
import {
	isTextComponent,
	setSettingErrorSpan,
} from "src/shared/obsidian-fp/setting";

type SubmitContext = RenderFormContext &
	PluginContext &
	AppContext &
	ModalContext;

type SK = {
	key: string;
	setting: Setting;
};

export const renderSubmitButton = (form: SK[]) =>
	pipe(
		RIO.ask<SubmitContext>(),
		RIO.tapIO((ctx) => () => {
			ctx.submitSetting.addButton((btn) => {
				btn.setButtonText("Submit").onClick(async () => {
					console.log("clicked");
					const submit = submitForm(form);
					const e = await submit(ctx)();
					console.log(e);
					ctx.onSubmit();
				});
			});
		})
	);

const submitForm = (fieldSettings: SK[]) => {
	const rte = pipe(
		Array.from(fieldSettings),
		A.map(getSettingTextValue),
		A.reduce({}, (acc, curr) => ({
			...acc,
			[curr.key]: curr.value,
		})),
		decodeFormRE,
		RE.bindTo("form"),
		RE.mapLeft((errors) => new DecodeError(errors)),
		RTE.fromReaderEither,
		RTE.tapError(RTE.fromIOK(setFieldErrors(fieldSettings))),
		RTE.bindW("result", ({ form }) => pingBlogFP(form)),
		RTE.map(({ result: { blog }, form }) => ({
			...blog,
			name: form.alias || blog.name,
			apiKey: form.apiKey,
			endpoint: form.endpoint,
			syncFolder: form.syncFolder,
		})),
		RTE.tap(upsertBlog),
		RTE.tap(refreshSettingsTab),
		RTE.tapError(RTE.fromReaderIOK(setSubmitError)),
		RTE.tapReaderIO(() => closeModal)
	);

	return rte;
};
const getSettingTextValue = ({ key, setting }: SK) =>
	pipe(
		setting.components,
		A.findFirst(isTextComponent),
		O.map((textComponent) => ({ key, value: textComponent.getValue() })),
		O.getOrElse(() => ({ key, value: "" }))
	);

const decodeFormRE =
	(form: any) =>
	({ app }: AppContext) =>
		blogModalFormSchema({ app }).decode(form);

const setSubmitError = (error: Error) => (ctx: RenderFormContext) =>
	setSettingErrorSpan(ctx.submitSetting)(error.message);

const refreshSettingsTab = () =>
	pipe(
		RTE.ask<RenderFormContext>(),
		RTE.tapIO((ctx) => () => ctx.onSubmit())
	);

type FormError = { key: string; msg: string | undefined };
const setFieldErrors = (controls: SK[]) => (de: DecodeError) => {
	const transformDecodeErrors = (errors: t.Errors) => {
		return errors
			.map((error) =>
				error.context
					.filter(({ key }) => key.length > 0)
					.map(({ key }) => ({ key, msg: error.message }))
			)
			.flat();
	};
	const setFieldError = ({ key, msg }: FormError) =>
		pipe(
			controls,
			A.findFirst((c) => c.key === key),
			O.map((ctrl) => setSettingErrorSpan(ctrl.setting)(msg ?? "")),
			O.getOrElse(() => () => {})
		);

	return pipe(
		de.errors,
		transformDecodeErrors,
		A.map(setFieldError),
		IO.sequenceArray
	);
};
