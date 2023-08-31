import {
	AppContext,
	BlogContext,
	FileStatus,
	Item,
	PluginConfigContext,
	PluginContextC,
} from "../shared/types";
import { flow, pipe } from "fp-ts/lib/function";
import { UploadPlan, planUpload } from "./confirm-push-changes/plan-upload";
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
import { O, A, E } from "src/shared/fp";
import { getFilesToCheck } from "./confirm-push-changes/get-files-to-check";
import { newLog } from "src/shared/plugin-data/upload-session/log";

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
		RTE.flatMap(planUpload),
		RTE.tapReaderIO(openConfirmationModal(pushChanges)),
		RTE.tapError(showErrorNoticeRTE)
	)(deps)();

	return res;
};

const pushChanges = (plan: UploadPlan) => {
	const { pending, md5Collision, slugCollision, toDelete } = plan;
	return pipe(
		// TODO session stuff is wonky
		setNewUploadSession,
		RTE.flatMap(() => getCurrentUploadSessionIdRTE),
		// TODO: check deleted file success
		RTE.tap(() => deleteFiles({ keys: plan.toDelete })),
		RTE.flatMapReaderTask((sessionId) =>
			pipe(
				pending,
				A.map((x) => ({ ...x, sessionId: O.some(sessionId) })),
				uploadItems,
				RT.map(aggregateUploadResults)
			)
		),
		RTE.map((result) => ({
			...result,
			logs: [
				...result.logs,
				newLog(`Upload complete. Uploaded: ${result.uploadCount}.`),
			],
		})),
		RTE.tap(({ uploadCount, errorCount, cancelCount, logs }) =>
			updateCurrentUploadSession({
				finishedAt: new Date().toISOString(),
				uploadCount,
				errorCount,
				cancelCount,
				skipCount: md5Collision.length + slugCollision.length,
				deleteCount: toDelete.length,
				logs,
			})
		),
		RTE.tapError(showErrorNoticeRTE),
		RTE.tapIO(
			(e) => () => showNotice("[Tuhua Publisher] Upload complete!")
		),
		RTE.fold(
			() => RT.of(undefined as void),
			() => RT.of(undefined as void)
		)
	);
};

const aggregateUploadResults = (items: Item[]) => {
	// TODO: sort here?
	const logs = items.flatMap((item) => item.logs);
	const uploadCount = items.filter(
		(item) => item.status === FileStatus.UPLOAD_SUCCESS
	).length;
	const cancelCount = items.filter(
		(item) => item.status === FileStatus.UPLOAD_CANCELLED
	).length;
	const errorCount = items.filter(
		(item) => item.status === FileStatus.UPLOAD_ERROR
	).length;

	return {
		logs,
		uploadCount,
		cancelCount,
		errorCount,
	};
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
