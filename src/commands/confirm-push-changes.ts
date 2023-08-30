import {
	AppContext,
	BlogContext,
	FileStatus,
	Item,
	PluginContextC,
} from "../shared/types";
import { pipe } from "fp-ts/lib/function";
import { UploadPlan, planUpload } from "./confirm-push-changes/plan-upload";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as A from "fp-ts/Array";
import { uploadItems } from "./confirm-push-changes/upload-items";
import { showNotice } from "src/shared/obsidian-fp";
import { deleteFiles } from "src/shared/network";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import { logForSession, setNewUploadSession } from "src/shared/plugin-data";
import { buildItemsRTE } from "./confirm-push-changes/build-items";
import { openConfirmationModal } from "./confirm-push-changes/open-confirmation-modal";
import { Modal } from "obsidian";
import { DEFAULT_CONFIG } from "src/shared/plugin-data/plugin-config";

type ConfirmPushChangesContext = AppContext & BlogContext & PluginContextC;

export const confirmPushChanges = async (
	context: ConfirmPushChangesContext
) => {
	const deps = {
		...context,
		pluginConfig: DEFAULT_CONFIG,
		modal: new Modal(context.app),
	};

	const res = await pipe(
		setNewUploadSession,
		RTE.flatMap(() => planUpload(buildItemsRTE)),
		RTE.flatMap(checkForChanges),
		RTE.tapReaderIO((plan) => openConfirmationModal(plan, pushChanges)),
		RTE.tapError(showErrorNoticeRTE),
		RTE.tapError((e) =>
			RTE.rightReaderTask(logForSession(e.message, "error"))
		)
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
