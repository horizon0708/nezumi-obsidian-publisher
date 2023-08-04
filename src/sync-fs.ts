import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as A from "fp-ts/Array";
import * as S from "fp-ts/State";
import { flow, pipe } from "fp-ts/function";
import {
	getSlugAndMaybeUpdateFrontmatter,
	getEmbeddedAssets,
	readPostRTE,
	getSlugFromFrontmatter,
	getDefaultSlugFromFile,
	updateSlug,
	updateSlug2,
	readPost,
	getEmbeddedAssets2,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";
import { App, TFile } from "obsidian";
import { Blog } from "./types";
import { sequenceT } from "fp-ts/lib/Apply";

type FileContext = {
	app: App;
	blog: Blog;
	file: TFile;
	serverMd5?: string;
};

enum FileStatus {
	NOOP = "NOOP",
	PENDING = "PENDING",
	SLUG_UPDATE_ERROR = "SKIP/SLUG_UPDATE_ERROR",
	SLUG_COLLISION = "SKIP/SLUG_COLLISION",
	MD5_COLLISION = "SKIP/MD5_COLLISION",
	READ_ERROR = "SKIP/READ_ERROR",
	PENDING_UPLOAD = "UPLOAD/PENDING",
}

export type Post = {
	slug: string;
	path: string;
	content: string;
	md5: string;
	serverMd5: string;
	embeddedAssets: Set<string>;
	status: FileStatus;
};

export type ErroredPost = {
	// This errors out unfortunately
	// status: Exclude<FileStatus, FileStatus.PENDING>;
	path: string;
	status: FileStatus;
} & Partial<Post>;

export type FileProcessingState = {
	serverPosts: ServerPosts;
	localPosts: LocalPosts;
	localSlugs: LocalSlugs;
	embeddedAssets: Set<string>;
};

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

type ServerPosts = Map<string, ServerFileState>;
type LocalPosts = Map<string, Post | ErroredPost>;
type LocalSlugs = Map<string, string>;

const createBasePost = pipe(
	SRTE.ask<FileProcessingState, FileContext>(),
	SRTE.map(({ file }) => ({
		path: file.path,
		status: FileStatus.PENDING,
	}))
);

const setSlug = <T>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext, any>(),
		SRTE.flatMapReaderTaskEither(({ file }) =>
			getSlugAndMaybeUpdateFrontmatter(file)
		),
		SRTE.map((slug) => ({ ...params, slug })),
		SRTE.mapLeft(() => ({
			...params,
			status: FileStatus.SLUG_UPDATE_ERROR,
		}))
	);

// const checkL =
// 	<T extends { slug: string }>(params: T) =>
// 	(state: { localSlugs: LocalSlugs }) => {
// 		const slug = params.slug;
// 		if (state.localSlugs.has(slug)) {
// 			return E.left({
// 				...params,
// 				status: FileStatus.SLUG_COLLISION,
// 			});
// 		}
// 		return E.right(params);
// 	};

// const lift = <T extends { slug: string }>(
// 	fn: (params: T) => (state: { localSlugs: LocalSlugs }) => E.Either<T, T>
// ): ((
// 	params: T
// ) => SRTE.StateReaderTaskEither<
// 	{ localSlugs: LocalSlugs },
// 	unknown,
// 	unknown,
// 	T
// >) => {
// 	return (params: T) => {
// 		return SRTE.fromEitherK(fn(params))
// 	};
// };

// const check2 = <T extends { slug: string }>(params: T) =>
// 	SRTE.fromEither(checkL(params));

// NEXT: kinda want to define liftEither
const checkLocalSlug = <T extends { slug: string }>(params: T) =>
	pipe(
		// annoying I have to specify types each time :/
		SRTE.get<FileProcessingState, FileContext>(),
		SRTE.chain((state: FileProcessingState) => {
			const slug = params["slug"];
			if (state.localSlugs.has(slug)) {
				return SRTE.left({
					...params,
					status: FileStatus.SLUG_COLLISION,
				});
			}
			return SRTE.right(params);
		})
	);

const registerLocalSlug = <T extends { slug: string }>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext>(),
		SRTE.chain(({ file }) =>
			SRTE.modify<FileProcessingState, FileContext>((state) => {
				// mutating but yeah, sue me.
				state.localSlugs.set(params.slug, file.path);
				return state;
			})
		)
	);

const setMarkdownContentAndMD5 = <T>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext>(),
		// so chainReaderTaskEitherK converts the typings of Deps?
		// A: yes K stands for Kleisli
		SRTE.chainReaderTaskEitherK(({ file }) => readPostRTE(file)),
		SRTE.mapLeft(() => ({
			...params,
			status: FileStatus.READ_ERROR,
		})),
		SRTE.map((content) => ({
			...params,
			content,
			md5: SparkMD5.hash(content),
		}))
	);

const getServerPath = (file: TFile) => (syncFolder: string) =>
	syncFolder === "/" ? file.path : file.path.slice(syncFolder.length + 1);

// chain is destroying type for Left
// Though I don't think it should be? it should be a union type

const setServerMD5 = <T>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext>(),
		SRTE.chain(({ file, blog }) =>
			SRTE.gets((state) => {
				const serverPath = getServerPath(file)(blog.syncFolder);
				return {
					...params,
					serverPath,
					serverMd5: state.serverPosts.get(serverPath)?.md5,
				};
			})
		),
		SRTE.mapLeft(() => ({ ...params, status: FileStatus.READ_ERROR }))
	);

const mark2 =
	({ serverPath }: { serverPath: string }) =>
	(state: FileProcessingState) => {
		const sp = state.serverPosts.get(serverPath);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return state;
	};

const liftA =
	<T, K>(fn: (params: T) => (state: K) => K) =>
	(params: T) =>
		SRTE.modify<K, unknown, unknown>(fn(params));

const rr = liftA(mark2);

// start from here to write lift function
const markServerPostAsHavingLocalCopy = <T extends { serverPath: string }>(
	params: T
) =>
	SRTE.modify<FileProcessingState, FileContext>((state) => {
		const sp = state.serverPosts.get(params.serverPath);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return state;
	});

const checkMD5 = <T extends { md5: string }>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext>(),
		SRTE.chain(({ serverMd5 }) =>
			serverMd5 && serverMd5 === params.md5
				? SRTE.left({
						...params,
						status: FileStatus.MD5_COLLISION,
				  })
				: SRTE.right(params)
		),
		SRTE.mapLeft(() => ({
			...params,
			status: FileStatus.MD5_COLLISION,
		}))
	);

const setEmbeddedAssets = <T>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext>(),
		SRTE.chainReaderTaskEitherK(({ file }) => getEmbeddedAssets(file)),
		SRTE.map((embeddedAssets) => ({
			...params,
			embeddedAssets,
		})),
		SRTE.mapLeft(() => ({
			...params,
			status: FileStatus.READ_ERROR,
		}))
	);

const registerEmbeddedAssets = <T extends { embeddedAssets: Set<string> }, K>(
	params: T
) =>
	SRTE.modify<FileProcessingState, FileContext, ErroredPost>((state) => {
		params.embeddedAssets.forEach((path) => {
			state.embeddedAssets.add(path);
		});
		return state;
	});

const pushPostToState = (post: Post) =>
	SRTE.modify<FileProcessingState, FileContext, ErroredPost>((state) => {
		state.localPosts.set(post.path, post);
		return state;
	});

SRTE.bind;

// group effects together! as they don't do anything
export const processPost: SRTE.StateReaderTaskEither<
	FileProcessingState,
	FileContext,
	ErroredPost,
	Post
> = pipe(
	createBasePost,
	SRTE.chain(setSlug),
	SRTE.chain(checkLocalSlug),
	SRTE.chainFirst(registerLocalSlug),
	SRTE.chain(setServerMD5),
	SRTE.chainFirst(markServerPostAsHavingLocalCopy),
	SRTE.chain(setMarkdownContentAndMD5),
	SRTE.chain(checkMD5),
	SRTE.chain(setEmbeddedAssets),
	SRTE.chainFirst(registerEmbeddedAssets)
);

const getSlug = pipe(
	RTE.Do,
	RTE.apS("fmSlug", getSlugFromFrontmatter),
	RTE.apS("defaultSlug", getDefaultSlugFromFile),
	RTE.map(({ fmSlug, defaultSlug }) => fmSlug || defaultSlug)
);

const maybeUpdateSlugInFrontmatter = (slug: string) =>
	pipe(
		RTE.Do,
		RTE.apS("fmSlug", getSlugFromFrontmatter),
		RTE.tap(({ fmSlug }) => {
			if (!fmSlug) {
				return;
			}
			return updateSlug2(slug);
		}),
		RTE.mapLeft(() => "error")
	);

//
// const setSlugT3 = RTE.asks(({ file, app }: FileContext) =>
// );

// i'm not sure if it is okay to mutate states like this

const getServerMd5 = (state: FileProcessingState) =>
	RTE.asks((deps: FileContext) => {
		const serverPath = getServerPath(deps.file)(deps.blog.syncFolder);
		return state.serverPosts.get(serverPath)?.md5 ?? "";
	});

const updateState = (arg: { slug: string }) => (s: FileProcessingState) => {
	s.localSlugs.set("a", "d");
	return s;
};

const registerLocalSlug2 =
	(slug: string, path: string) => (s: FileProcessingState) => {
		s.localSlugs.set(slug, path);
		return s;
	};

const markServerPostAsHavingLocalCopy2 =
	(serverPath: string) => (state: FileProcessingState) => {
		const sp = state.serverPosts.get(serverPath);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return state;
	};

const registerEmbeddedAssets2 =
	(embeddedAssets: Set<string>) => (state: FileProcessingState) => {
		embeddedAssets.forEach((path) => {
			state.embeddedAssets.add(path);
		});
		return state;
	};

const getPath = RTE.asks((deps: FileContext) => deps.file.path);

export const testFn = pipe(
	SRTE.get<FileProcessingState, FileContext>(),
	SRTE.chainReaderTaskEitherK((state) =>
		pipe(
			RTE.Do,
			RTE.apSW("path", getPath),
			RTE.apSW("slug", getSlug),
			RTE.tap(({ slug }) => maybeUpdateSlugInFrontmatter(slug)),
			RTE.chainW((params) => {
				return state.localSlugs.has(params.slug)
					? RTE.left("slug collision")
					: RTE.right(params);
			}),
			RTE.apSW("serverMd5", getServerMd5(state)),
			RTE.apSW("content", readPost),
			RTE.bindW("md5", (params) => RTE.of(SparkMD5.hash(params.content))),
			RTE.apSW("embeddedAssets", getEmbeddedAssets2)
		)
	),
	// side effects that modify state
	SRTE.tap((args) =>
		pipe(
			[
				registerLocalSlug2(args.slug, args.path),
				markServerPostAsHavingLocalCopy2(args.serverMd5),
				registerEmbeddedAssets2(args.embeddedAssets),
			],
			A.map(SRTE.modify),
			SRTE.sequenceArray
		)
	)
	// SRTE.get<FileProcessingState, FileContext>(),
	// SRTE.modify(updateState({ slug: "a" }))
	// NEXT: have a list of task and map over the args
	// SRTE.chain(e => )
);
