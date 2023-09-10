import { E, RE, RTE, TE, pipe, t } from "src/shared/fp";
import { FormField } from "../edit-modal";
import { pingBlogFP } from "src/shared/network";
import { upsertBlog } from "src/shared/plugin-data";
import { NetworkError, DecodeError } from "src/shared/errors";
import { AppContext } from "src/shared/types";
import { blogModalFormSchema } from "./edit-modal-config";
import { connect } from "src/shared/network-new/connect";

type SubmitFormProps = {
	onSuccess: () => void;
	onError: (e: NetworkError | Error | DecodeError) => void;
};

export const submitForm = (
	fields: FormField[],
	{ onSuccess, onError }: SubmitFormProps
) =>
	pipe(
		fields,
		getFormValues,
		decodeFormRE,
		RE.bindTo("form"),
		RE.mapLeft((e) => new DecodeError(e)),
		RTE.fromReaderEither,
		RTE.bindW("result", ({ form }) => connect(form)),
		RTE.map(({ result: { data: blog }, form }) => ({
			...blog,
			name: form.alias || blog.name,
			apiKey: form.apiKey,
			endpoint: form.endpoint,
			syncFolder: form.syncFolder,
		})),
		RTE.tap(upsertBlog),
		RTE.tapIO(() => onSuccess),
		RTE.tapError(
			RTE.fromIOK((e) => () => {
				if (e instanceof DecodeError) {
					pipe(
						e.errors,
						transformDecodeErrors,
						setFieldErrors(fields)
					);
				}
				onError(e);
			})
		)
	);

const getFormValues = (fields: FormField[]): Record<string, string | null> => {
	return fields.reduce(
		(acc, curr) => ({
			...acc,
			[curr.key]: curr.control.value,
		}),
		{}
	);
};

const decodeFormRE =
	(form: any) =>
	({ app }: AppContext) =>
		blogModalFormSchema({ app }).decode(form);

const transformDecodeErrors = (errors: t.Errors) => {
	return errors
		.map((error) =>
			error.context
				.filter(({ key }) => key.length > 0)
				.map(({ key }) => ({ key, msg: error.message }))
		)
		.flat();
};

const setFieldErrors =
	(fields: FormField[]) =>
	(errors: { key: string; msg: string | undefined }[]) => {
		errors.forEach((e) => {
			fields.find((f) => f.key === e.key)?.control.setError(e.msg ?? "");
		});
	};
