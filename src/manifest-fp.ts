import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as TE from "fp-ts/TaskEither";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFiles_RTE } from "./obsidian-fp";
import { Blog } from "./types";
import { processPost } from "./sync-fs";

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

type State = {
	serverPosts: Map<string, ServerFileState>;
	localPosts: Map<string, Record<string, string>>;
	localSlugs: Map<string, string>;
	embeddedAssets: Set<string>;
};

type BlogContext = {
	blog: Blog;
};

const re = pipe(SRTE.modify((state: State) => ({ ...state })));

export const getFilesToBeSynced_SRTE = pipe(
	SRTE.asks((deps: BlogContext) => deps.blog.syncFolder),
	SRTE.chainW((syncFolder) =>
		pipe(
			getFiles_RTE,
			SRTE.fromReaderTaskEither,
			SRTE.map(
				flow(
					A.filter((file) => file.path.endsWith(".md")),
					A.filter((file) => file.path.startsWith(syncFolder))
				)
			)
			// flatmap?
		)
	)
);

const getServerPath = (file: TFile) => (syncFolder: string) =>
	syncFolder === "/" ? file.path : file.path.slice(syncFolder.length + 1);

const addFilesToServerPosts = (file: TFile) => {
	return pipe(
		SRTE.gets((state: State) => state.serverPosts),
		SRTE.chain((serverPosts) =>
			pipe(
				SRTE.asks((deps: BlogContext) => deps.blog.syncFolder),
				SRTE.chain(flow(getServerPath(file), SRTE.of)),
				SRTE.chain((serverKey) => {
					const serverMd5 = serverPosts.get(serverKey);
					if (serverMd5) {
						// mutation
						serverMd5.hasLocalCopy = true;
					}
					return SRTE.of(serverMd5?.md5 ?? "");
				})
			)
		),
		SRTE.map((serverMd5) => ({ file, serverMd5 }))
	);
};

const addFilesToLocalPostsAndSlugs = ({
	file,
}: {
	file: TFile;
	serverMd5: string;
}) => pipe(SRTE.gets((state: State) => state));

export const processManifest = pipe(
	getFilesToBeSynced_SRTE,
	SRTE.map(
		flow(
			A.map(flow(addFilesToServerPosts)),
			SRTE.sequenceArray,
			SRTE.chainW(A.map(Array.from))
		)
	)
);

// equivalent to above - leaving it for posterity/ study later
const getFiles_SRTE_flipped = pipe(
	getFiles_RTE,
	RTE.chainW((files) =>
		pipe(
			RTE.asks((deps: BlogContext) => deps.blog.syncFolder),
			RTE.map(
				flow(
					(syncFolder) =>
						A.filter<TFile>((file) =>
							file.path.startsWith(syncFolder)
						)(files),
					A.filter((file) => file.path.endsWith(".md"))
				)
			)
		)
	)
);

// const postManifest = (serverFiles: ServerFileState[]) =>
// 	pipe(
// 		SRTE.put({
// 			serverFiles,
// 			localPosts: new Map<string, Record<string, string>>(),
// 			localSlugs: new Map<string, string>(),
// 			embeddedAssets: new Set<string>(),
// 		}),
//         SRTE.
// 	);
