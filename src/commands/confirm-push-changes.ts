import { buildPluginConfig } from "src/shared/plugin-config";
import { BaseContext, FileStatus, Item, PluginContext } from "../shared/types";
import { pipe } from "fp-ts/lib/function";
import { UploadPlan, planUpload } from "./confirm-push-changes/plan-upload";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import { uploadItems } from "./confirm-push-changes/upload-items";
import { showNotice } from "src/shared/obsidian-fp";
import { deleteFiles } from "src/shared/network";
import { showErrorNoticeRTE } from "src/shared/notifications";
import { logForSession, setNewUploadSession } from "src/shared/plugin-data";
import { buildItemsRTE } from "./confirm-push-changes/build-items";
import { ConfirmationModal } from "./confirm-push-changes/confirmation-modal";

export const confirmPushChanges = async (
	context: Omit<BaseContext, "pluginConfig"> & PluginContext
) => {
	const pluginConfig = buildPluginConfig();
	const deps = { ...context, pluginConfig };
	const confirmationModal = new ConfirmationModal(deps);

	const res = await pipe(
		setNewUploadSession,
		RTE.chainW(() => planUpload(buildItemsRTE)),
		RTE.chainW(
			RTE.fromPredicate(
				hasItemsToUpload,
				(plan) =>
					new Error(
						plan.toSkip
							? "No changes to upload"
							: "Couldn't find any files to upload!"
					)
			)
		),
		RTE.tapIO((plan) => () => {
			if (plan.toUpload.length > 0) {
				confirmationModal.render(plan, pushChanges);
				confirmationModal.open();
			}
		}),
		RTE.tapError(showErrorNoticeRTE)
		// IMPROVEMENT: return delete result
	)(deps)();

	return res;
};

const hasItemsToUpload = (plan: UploadPlan) => plan.toUpload.length > 0;

const pushChanges = (plan: UploadPlan) => {
	return pipe(
		RTE.of(plan),
		RTE.tap(({ toDelete }) => deleteFiles({ keys: toDelete })),
		RTE.chainW(({ toUpload, toSkip }) =>
			pipe(
				uploadItems(toUpload),
				RTE.map(uploadedItemToResult),
				RTE.map((result) => ({
					...result,
					skippedCount: toSkip.length,
				}))
			)
		),
		RTE.tapReaderTask((result) =>
			logForSession(
				`Upload complete. ${result.successCount} files uploaded, ${result.errorCount} errors, ${result.skippedCount} skipped.`
			)
		),
		RTE.tapError(showErrorNoticeRTE),
		RTE.tapIO((e) => () => showNotice(JSON.stringify(e))),
		RTE.fold(
			() => RT.of(undefined as void),
			() => RT.of(undefined as void)
		)
	);
};

const uploadedItemToResult = (items: readonly Item[]) =>
	pipe(
		Array.from(items),
		A.partition((item) => item.status === FileStatus.UPLOAD_SUCCESS),
		({ left, right }) => ({
			successCount: right.length,
			errorCount: left.length,
		})
	);
