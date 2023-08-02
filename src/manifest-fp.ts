import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as TE from "fp-ts/TaskEither";
import { App, TFile } from "obsidian";
import { flow, pipe } from "fp-ts/function";
import { getFiles_RTE } from "./obsidian-fp";
import { Blog } from "./types";
import { processPost } from "./sync-fs";
import { sequenceT } from "fp-ts/lib/Apply";
import { Semigroup } from "fp-ts/Semigroup";

type Post = Record<string, any>;

type ProcessedPost = {
	data: Post;
};

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

type ManifestContext = {
	app: App;
	blog: Blog;
	serverPosts: Map<string, ServerFileState>;
};

const re = pipe(SRTE.modify((state: State) => ({ ...state })));
(window as any).tee = () => console.log("hi");

export const getFilesToBeSynced_RTE = pipe(
	RTE.asks((deps: BlogContext) => deps.blog.syncFolder),
	RTE.chainW((syncFolder) =>
		pipe(
			getFiles_RTE,
			RTE.map(
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

const checkServerPosts = (file: TFile) =>
	pipe(
		RTE.asks((deps: ManifestContext) => deps),
		RTE.chainW(({ serverPosts, app, blog }) => {
			return RTE.of({
				app,
				blog,
				file,
			});
		})
	);

const addFilesToServerPosts_RTE = (file: TFile) =>
	pipe(
		RTE.asks((deps: ManifestContext) => deps),
		RTE.chainW(({ serverPosts, app, blog }) =>
			pipe(processPost({ app, blog, file }), RTE.fromTaskEither)
		)
	);

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

export const processManifest = pipe(
	RTE.asks((deps: ManifestContext) => deps),
	RTE.chain(({ serverPosts, blog }) =>
		pipe(
			getFilesToBeSynced_RTE,
			RTE.map(
				flow(
					A.map((file) => processPost({ app, blog, file })),
					A.reduce(
						TE.of<never, Record<string, any>[]>([]),
						sequenceT(TE.ApplySeq)
					)
				)
			)
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
