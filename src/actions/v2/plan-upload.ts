import { flow, pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import { getFileListFp } from "src/io/network";
import { newProcessingState } from "./manifest-state";
import { BaseContext, FileType } from "../types";
import * as A from "fp-ts/Array";
import { getFile, getFiles } from "src/io/obsidian-fp2";
import { getType } from "./build-base-item";
import { buildItems } from "./build-items";

export const planUpload = () =>
	pipe(
		RTE.Do,
		RTE.apS(
			"files",
			pipe(
				getFileListFp,
				RTE.map(({ posts, assets }) => [...posts, ...assets])
			)
		),
		RTE.bind("state", ({ files }) => RTE.of(newProcessingState(files))),
		RTE.chainW(({ state }) =>
			pipe(getSyncCandidateFiles, RTE.chain(buildItems(state)))
		),
		RTE.chainW(({ left, right, state }) =>
			pipe(
				Array.from(state.embeddedAssets),
				A.map(RTE.fromReaderK(getFile)),
				RTE.sequenceArray,
				RTE.map((arr) => A.compact(Array.from(arr))),
				RTE.chain(buildItems(state)),
				RTE.map(({ left: left2, right: right2, state: state2 }) => ({
					left: left.concat(left2),
					right: right.concat(right2),
					state: state2,
				}))
			)
		),
		RTE.map((args) => {
			const toDelete: string[] = [];
			args.state.serverPosts.forEach((value, key) => {
				if (!value.hasLocalCopy) {
					toDelete.push(key);
				}
			});
			return { ...args, toDelete };
		})
	);

const getSyncCandidateFiles = pipe(
	RTE.ask<BaseContext>(),
	RTE.chainW(({ blog: { syncFolder } }) =>
		pipe(
			getFiles,
			RTE.fromReader,
			RTE.map(
				flow(
					A.filter(
						(file) =>
							getType(file.path) === FileType.POST &&
							file.path.startsWith(syncFolder)
					)
				)
			)
		)
	)
);
