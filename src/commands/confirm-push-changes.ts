import {
	AppContext,
	BlogContext,
	FileStatus,
	Item,
	PluginConfigContext,
	PluginContextC,
} from "../shared/types";
import {
	UploadPlan,
	UploadPlans,
	planUpload,
} from "./confirm-push-changes/plan-upload";
import { uploadItems } from "./confirm-push-changes/upload-items";
import { getFile, showNotice } from "src/shared/obsidian-fp";
import { deleteFiles } from "src/shared/network";
import { showErrorNoticeRTE } from "src/shared/obsidian-fp/notifications";
import {
	setNewUploadSession,
	updateCurrentUploadSession,
} from "src/shared/plugin-data";
import { buildItems } from "./confirm-push-changes/build-items";
import { openConfirmationModal } from "./confirm-push-changes/open-confirmation-modal";
import { Modal, RequestUrlResponse } from "obsidian";
import { DEFAULT_CONFIG } from "src/shared/plugin-data/plugin-config";
import { getCurrentUploadSessionIdRTE } from "src/shared/plugin-data/upload-session";
import { O, A, RT, RTE, pipe, r, R } from "src/shared/fp";
import { getPostsToCheck } from "./confirm-push-changes/get-posts-to-check";
import { newLog } from "src/shared/plugin-data/upload-session/log";
import { SlugMap } from "./confirm-push-changes/plan-upload/slug-map";
import { Separated } from "fp-ts/lib/Separated";
import { NetworkError } from "src/shared/errors";
import { deleteAssets, deletePosts } from "src/shared/network-new";
import { pushChanges } from "./confirm-push-changes/push-changes";

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
		getPostsToCheck(),
		RT.fromReader,
		RT.chain(buildItems),
		RT.bindTo("posts"),
		RT.bind("assets", ({ posts }) => buildAssets(posts.right)),
		RTE.rightReaderTask,
		RTE.flatMap(planUpload),
		RTE.tapReaderIO(openConfirmationModal(pushChanges))
		// RTE.tapError(showErrorNoticeRTE)
	)(deps)();

	return res;
};

const buildAssets = (items: Item[]) => {
	return pipe(
		items,
		A.map((item) => item.embeddedAssets),
		concatSets,
		(set) => Array.from(set),
		A.map(getFile),
		A.sequence(R.Applicative),
		R.map(A.compact),
		RT.fromReader,
		RT.chain(buildItems)
	);
};

type BuildItemResult = Separated<Error[], Item[]>;
const mergeSeparated = (a: BuildItemResult) => (b: BuildItemResult) => {
	return {
		left: [...a.left, ...b.left],
		right: [...a.right, ...b.right],
	};
};

// apparently this is fastest
// https://stackoverflow.com/a/50296208
const concatSets = <T>(sets: Set<T>[]) => {
	const set = new Set<T>();
	for (const iterable of sets) {
		for (const item of iterable) {
			set.add(item);
		}
	}
	return set;
};

type DeleteRTE = typeof deletePosts;

const pushDeletes = (plan: UploadPlan, deleteRTE: DeleteRTE) =>
	pipe({ slugs: plan.toDelete }, deleteRTE);

const pushUploads = (
	plan: UploadPlan,
	sessionId: string,
	combinedSlugMap: SlugMap
) => {
	return pipe(
		plan.pending,
		A.map((x) => ({
			...x,
			sessionId: O.some(sessionId),
			links: convertPathToSlug(x.links, combinedSlugMap),
		})),
		uploadItems,
		RT.map(aggregateUploadResults),
		RTE.rightReaderTask
	);
};

const pushChanges2 = ({ postPlan, assetPlan }: UploadPlans) => {
	return pipe(
		RTE.Do,
		RTE.bindW("sessionId", setNewSession),
		RTE.tap(() => pushDeletes(postPlan, deletePosts)),
		RTE.tap(() => pushDeletes(assetPlan, deleteAssets)),
		// TODO: merge slug maps
		RTE.let("combinedSlugMap", () => postPlan.slugMap),
		RTE.bindW("postResult", ({ sessionId, combinedSlugMap }) =>
			pushUploads(postPlan, sessionId, combinedSlugMap)
		),
		RTE.bindW("assetResult", ({ sessionId, combinedSlugMap }) =>
			pushUploads(assetPlan, sessionId, combinedSlugMap)
		),
		// TODO: end session etc
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

const setNewSession = () => {
	return pipe(
		setNewUploadSession,
		RTE.flatMap(() => getCurrentUploadSessionIdRTE)
	);
};

// const pushChanges = ({ postPlan, assetPlan }: UploadPlans) => {
// 	const { pending, md5Collision, slugCollision, toDelete } = plan;
// 	return pipe(
// 		// TODO session stuff is wonky
// 		setNewUploadSession,
// 		RTE.flatMap(() => getCurrentUploadSessionIdRTE),
// 		// TODO: check deleted file success
// 		RTE.tap(() => deleteAssets({ slugs: assetSlugsToDelete(toDelete) })),
// 		RTE.tap(() => deletePosts({ slugs: postSlugsToDelete(toDelete) })),
// 		RTE.flatMapReaderTask((sessionId) =>
// 			pipe(
// 				pending,
// 				A.map((x) => ({
// 					...x,
// 					sessionId: O.some(sessionId),
// 					links: convertPathToSlug(x.links, plan.slugMap),
// 				})),
// 				uploadItems,
// 				RT.map(aggregateUploadResults)
// 			)
// 		),
// 		RTE.map((result) => ({
// 			...result,
// 			logs: [
// 				...result.logs,
// 				newLog(`Upload complete. Uploaded: ${result.uploadCount}.`),
// 			],
// 		})),
// 		RTE.tap(({ uploadCount, errorCount, cancelCount, logs }) =>
// 			updateCurrentUploadSession({
// 				finishedAt: new Date().toISOString(),
// 				uploadCount,
// 				errorCount,
// 				cancelCount,
// 				skipCount: md5Collision.length + slugCollision.length,
// 				deleteCount: toDelete.length,
// 				logs,
// 			})
// 		),
// 		RTE.tapError(showErrorNoticeRTE),
// 		RTE.tapIO(
// 			(e) => () => showNotice("[Tuhua Publisher] Upload complete!")
// 		),
// 		RTE.fold(
// 			() => RT.of(undefined as void),
// 			() => RT.of(undefined as void)
// 		)
// 	);
// };

const convertPathToSlug = (links: Record<string, string>, slugMap: SlugMap) => {
	const maybeTuples = Object.entries(links).map(([link, path]) => {
		const slug = slugMap.getByPath(path);
		if (!slug) {
			return O.none;
		}
		return O.some([link, slug] as [string, string]);
	});

	return pipe(maybeTuples, A.compact, r.fromEntries);
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
