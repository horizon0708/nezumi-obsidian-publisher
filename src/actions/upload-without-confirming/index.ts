import { BaseContext, FileStatus } from "../types";
import { planUpload } from "../plan-upload";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import { uploadItems } from "../uploader";
import { buildPluginConfig } from "src/plugin-config";
import { showNotice } from "src/io/obsidian-fp";

export const uploadWithoutConfirming = async (
	context: Omit<BaseContext, "pluginConfig">
) => {
	const pluginConfig = buildPluginConfig();
	const deps = { ...context, pluginConfig };

	const res = await pipe(
		planUpload(),
		RTE.chain(({ items }) => uploadItems(items)),
		RTE.chain(([r, skipped]) =>
			pipe(
				r,
				// A.map((r) => r.serverPath),
				A.partition((e) => e.status === FileStatus.UPLOAD_SUCCESS),
				({ left, right }) => {
					return {
						successCount: right.length,
						errorCount: left.length,
						skippedCount: skipped.length,
					};
				},
				// A.map(e =>  e)
				RTE.of
			)
		),
		// TODO: show better notice
		// TODO: save detailed log to see for debugging
		RTE.tapIO((e) => () => showNotice(JSON.stringify(e)))
		// RTE.tap(e => {

		// }),
	)(deps)();

	console.log(res);
	return res;
};
