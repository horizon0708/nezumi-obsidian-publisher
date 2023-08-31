import {
	AppContext,
	BlogContext,
	FileStatus,
	Item,
	PluginConfigContext,
	PluginContextC,
} from "../shared/types";
import { pipe } from "fp-ts/lib/function";
import { UploadPlan, sortItems } from "./confirm-push-changes/sort-items";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import { uploadItems } from "./confirm-push-changes/upload-items";
import { showNotice } from "src/shared/obsidian-fp";
import { deleteFiles } from "src/shared/network";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import {
	logForSession,
	setNewUploadSession,
	updateCurrentUploadSession,
} from "src/shared/plugin-data";
import { buildItems } from "./confirm-push-changes/build-items";
import { openConfirmationModal } from "./confirm-push-changes/open-confirmation-modal";
import { Modal } from "obsidian";
import { DEFAULT_CONFIG } from "src/shared/plugin-data/plugin-config";
import { getCurrentUploadSessionIdRTE } from "src/shared/plugin-data/upload-session";
import { O, A } from "src/shared/fp";
import { getFilesToCheck } from "./confirm-push-changes/get-files-to-check";

export type ConfirmPushChangesContext = AppContext &
	BlogContext &
	PluginContextC &
	PluginConfigContext;

export const confirmPushChanges = async (
	context: Omit<ConfirmPushChangesContext, "pluginConfig">
) => {
	const deps = {
		...context,
		pluginConfig: DEFAULT_CONFIG,
		modal: new Modal(context.app),
	};

	const res = await pipe(
		getFilesToCheck(),
		RT.fromReader,
		RT.chain(buildItems),
		RTE.rightReaderTask,
		RTE.flatMap(sortItems),
		RTE.flatMap(checkForChanges),
		RTE.tapReaderIO(openConfirmationModal(pushChanges)),
		RTE.tapError(showErrorNoticeRTE)
	)(deps)();

	return res;
};

const checkForChanges = RTE.fromPredicate(
	(plan: UploadPlan) => plan.toUpload.length > 0 || plan.toDelete.length > 0,
	(plan) =>
		new Error(
			plan.toSkip
				? "No changes to upload"
				: "Couldn't find any files to upload!"
		)
);

const pushChanges = (plan: UploadPlan) => {
	return pipe(
		RTE.of(plan),
		RTE.tap(() => setNewUploadSession),
		RTE.bindW("sessionId", () => getCurrentUploadSessionIdRTE),
		// TODO: check deleted file success
		RTE.tap(({ toDelete }) => deleteFiles({ keys: toDelete })),
		RTE.chainW(({ toUpload, toSkip, sessionId, toDelete }) =>
			pipe(
				toUpload,
				A.map((x) => ({ ...x, sessionId: O.some(sessionId) })),
				uploadItems,
				RTE.map(uploadedItemToResult),
				RTE.map((result) => ({
					...result,
					skippedCount: toSkip.length,
					deleteCount: toDelete.length,
				}))
			)
		),
		RTE.tapReaderTask((result) =>
			logForSession(
				`Upload complete. ${result.successCount} files uploaded, ${result.errorCount} errors, ${result.skippedCount} skipped.`
			)
		),
		RTE.tap((result) =>
			updateCurrentUploadSession({
				finishedAt: new Date().toISOString(),
				uploadCount: result.successCount,
				errorCount: result.errorCount,
				skipCount: result.skippedCount,
				deleteCount: result.deleteCount,
			})
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
