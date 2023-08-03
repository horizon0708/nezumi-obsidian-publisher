import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as A from "fp-ts/Array";
import * as S from "fp-ts/State";
import { flow, pipe } from "fp-ts/function";
import {
	getAndMaybeUpdateSlug,
	getEmbeddedAssets,
	readPostRTE,
} from "./obsidian-fp";
import SparkMD5 from "spark-md5";
import { App, TFile } from "obsidian";
import { Blog } from "./types";

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
	content: string;
	md5: string;
	serverMd5: string;
	embeddedAssets: Set<string>;
	status: FileStatus;
};

export type ErroredPost = {
	// This errors out unfortunately
	// status: Exclude<FileStatus, FileStatus.PENDING>;
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
type LocalPosts = Map<string, Record<string, string>>;
type LocalSlugs = Map<string, string>;

type SS = { n: Map<number, number> };

const t2: (
	num: number
) => SRTE.StateReaderTaskEither<SS, {}, unknown, number> = (num) =>
	pipe(
		SRTE.of(num * 2),
		SRTE.tap((n) =>
			SRTE.modify((s: SS) => {
				s.n.set(n, n * 2);
				return s;
			})
		)
	);

export const tester = (nums: number[]) =>
	pipe(A.map(t2)(nums), SRTE.sequenceArray);

const a = <T>(p: T) => SRTE.of({ ...p, a: "a" });
const b = <T>(p: T) => SRTE.of({ ...p, b: "b" });
const c = <T extends { b: string }>(p: T) => SRTE.of({ ...p, c: "c" });

const example1 = pipe(a({}), SRTE.chain(b), SRTE.chain(c));

const setSlug = <T>(params: T) =>
	pipe(
		SRTE.ask<FileProcessingState, FileContext, any>(),
		SRTE.flatMapReaderTaskEither(({ file }) => getAndMaybeUpdateSlug(file)),
		SRTE.map((slug) => ({ ...params, slug })),
		SRTE.mapLeft(() => ({
			...params,
			status: FileStatus.SLUG_UPDATE_ERROR,
		}))
	);

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

// I want this to be Effect...
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

const setServerMD5 = <T, K>(params: T) =>
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

// NEXT: register embedded assets

const registerEmbeddedAssets = <T extends { embeddedAssets: Set<string> }, K>(
	params: T
) =>
	SRTE.modify<FileProcessingState, FileContext, ErroredPost>((state) => {
		params.embeddedAssets.forEach((path) => {
			state.embeddedAssets.add(path);
		});
		return state;
	});

const initialState = { status: FileStatus.PENDING };

// TODO: test this and clean up
export const processPost: SRTE.StateReaderTaskEither<
	FileProcessingState,
	FileContext,
	ErroredPost,
	Post
> = pipe(
	setSlug(initialState),
	SRTE.chain(checkLocalSlug),
	SRTE.chainFirst(registerLocalSlug),
	SRTE.chain(setServerMD5),
	SRTE.chainFirst(markServerPostAsHavingLocalCopy),
	SRTE.chain(setMarkdownContentAndMD5),
	SRTE.chain(checkMD5),
	SRTE.chain(setEmbeddedAssets),
	SRTE.chainFirst(registerEmbeddedAssets)
	// SRTE.chainEitherK((e) => E.fold(e => E.right(e), r => E.right(r))(e))
);

const be = setSlug(initialState);
