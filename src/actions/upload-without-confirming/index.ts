import { BaseContext } from "../types";
import { planUpload } from "../plan-upload";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { uploadItems } from "../uploader";
import { buildPluginConfig } from "src/plugin-config";

export const uploadWithoutConfirming = async (
	context: Omit<BaseContext, "pluginConfig">
) => {
	const pluginConfig = buildPluginConfig();
	const deps = { ...context, pluginConfig };

	const res = await pipe(
		planUpload(),
		RTE.chain(({ items }) => uploadItems(items))
	)(deps)();

	console.log(res);
	return res;
};
