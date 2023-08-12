import { buildPluginConfig } from "src/plugin-config";
import { BaseContext, FileStatus } from "../types";
import { pipe } from "fp-ts/lib/function";
import { planUpload } from "./plan-upload";
import * as RTE from "fp-ts/ReaderTaskEither";

import * as A from "fp-ts/Array";
import { uploadItems } from "../uploader";
import { showNotice } from "src/io/obsidian-fp";

export const upload = async (context: Omit<BaseContext, "pluginConfig">) => {
	const pluginConfig = buildPluginConfig();
	const deps = { ...context, pluginConfig };

	const res = await pipe(
		planUpload(),
		RTE.chainW(({ items }) => uploadItems(items)),
		RTE.map(([r, skipped]) =>
			pipe(
				Array.from(r),
				A.partition((e) => e.status === FileStatus.UPLOAD_SUCCESS),
				({ left, right }) => {
					return {
						successCount: right.length,
						errorCount: left.length,
						skippedCount: skipped.length,
					};
				}
			)
		),
		RTE.tapIO((e) => () => showNotice(JSON.stringify(e)))
	)(deps)();

	console.log(res);
	return res;
};
