import { buildPluginConfig } from "src/shared/plugin-config";
import { BaseContext, FileStatus, PluginContext } from "../shared/types";
import { pipe } from "fp-ts/lib/function";
import { planUpload } from "./upload/plan-upload";
import * as RTE from "fp-ts/ReaderTaskEither";

import * as A from "fp-ts/Array";
import { uploadItems } from "./upload/upload-items";
import { showNotice } from "src/shared/obsidian-fp";
import { deleteFiles } from "src/shared/network";
import { showErrorNoticeRTE } from "src/shared/notifications";
import { logForSession, setNewUploadSession } from "src/shared/plugin-data";
import { buildItemsRTE } from "./upload/build-items";

export const upload = async (
	context: Omit<BaseContext, "pluginConfig"> & PluginContext
) => {
	const pluginConfig = buildPluginConfig();
	const deps = { ...context, pluginConfig };

	const res = await pipe(
		setNewUploadSession,
		RTE.chainW(() => planUpload(buildItemsRTE)),
		// IMPROVEMENT: return delete result
		RTE.tap(({ toDelete }) => deleteFiles({ keys: toDelete })),
		RTE.chainW(({ items }) => uploadItems(items)),
		RTE.map(([r, skipped]) =>
			pipe(
				Array.from(r),
				A.partition((e) => e.status === FileStatus.UPLOAD_SUCCESS),
				(e) => {
					console.log(e);
					return e;
				},
				({ left, right }) => {
					return {
						successCount: right.length,
						errorCount: left.length,
						skippedCount: skipped.length,
					};
				}
			)
		),
		RTE.tapReaderTask((result) =>
			logForSession(
				`Upload complete. ${result.successCount} files uploaded, ${result.errorCount} errors, ${result.skippedCount} skipped.`
			)
		),
		RTE.tapError(showErrorNoticeRTE),
		RTE.tapIO((e) => () => showNotice(JSON.stringify(e)))
	)(deps)();

	return res;
};