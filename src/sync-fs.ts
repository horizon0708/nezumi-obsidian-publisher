import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as A from "fp-ts/Array";
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

type State = {
	serverPosts: ServerPosts;
	localPosts: LocalPosts;
	localSlugs: LocalSlugs;
};

type ServerFileState = {
	md5: string;
	hasLocalCopy: boolean;
};

type ServerPosts = Map<string, ServerFileState>;
type LocalPosts = Map<string, Record<string, string>>;
type LocalSlugs = Map<string, string>;

type Params = [Record<string, any>, ServerPosts, LocalPosts, LocalSlugs];

type FileParamsBuilder2 = (
	params: Params
) => RTE.ReaderTaskEither<FileContext, unknown, Params>;

type FileParamsBuilder = (
	params: Record<string, any>
) => SRTE.StateReaderTaskEither<
	State,
	FileContext,
	unknown,
	Record<string, any>
>;

type FileParamsEffect = (
	params: Record<string, any>
) => SRTE.StateReaderTaskEither<State, FileContext, unknown, void>;

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

// is there a type safe wayt to get both state and deps?
const t: FileParamsBuilder = (params) => (state) => (deps) =>
	TE.of([{}, state]);

const a = <T>(p: T) => SRTE.of({ ...p, a: "a" });
const b = <T>(p: T) => SRTE.of({ ...p, b: "b" });
const c = <T extends { b: string }>(p: T) => SRTE.of({ ...p, c: "c" });

const example1 = pipe(a({}), SRTE.chain(c), SRTE.chain(b));

const setSlug: FileParamsBuilder = (params) =>
	pipe(
		SRTE.ask<State, FileContext>(),
		SRTE.flatMapReaderTaskEither(({ file }) => getAndMaybeUpdateSlug(file)),
		SRTE.map((slug) => ({ slug }))
	);

const checkLocalSlug: FileParamsBuilder = (params) =>
	pipe(
		// annoying I have to specify types each time :/
		SRTE.get<State, FileContext>(),
		SRTE.chain((state: State) => {
			const slug = params["slug"];
			if (state.localSlugs.has(slug)) {
				return SRTE.left("slug already exists");
			}
			return SRTE.right(params);
		})
	);

// I want this to be Effect...
const registerLocalSlug: FileParamsEffect = (params) =>
	pipe(
		SRTE.ask<State, FileContext>(),
		SRTE.chain(({ file }) =>
			SRTE.modify<State, FileContext>((state) => {
				// mutating but yeah, sue me.
				state.localSlugs.set(params.slug, file.path);
				return state;
			})
		)
	);

const setContentAndMD5: FileParamsBuilder = (params) =>
	pipe(
		SRTE.ask<State, FileContext>(),
		SRTE.chainReaderTaskEitherK(({ file }) => readPostRTE(file)),
		SRTE.map((content) => ({
			...params,
			content,
			md5: SparkMD5.hash(content),
		}))
	);

const getServerPath = (file: TFile) => (syncFolder: string) =>
	syncFolder === "/" ? file.path : file.path.slice(syncFolder.length + 1);

const setServerMD5: FileParamsBuilder = (params) =>
	pipe(
		SRTE.ask<State, FileContext>(),
		SRTE.chainFirst(({ file, blog }) =>
			SRTE.gets<State, FileContext, unknown, Record<string, any>>(
				(state) => {
					const serverPath = getServerPath(file)(blog.syncFolder);
					return {
						...params,
						serverPath,
						serverMd5: state.serverPosts.get(serverPath)?.md5,
					};
				}
			)
		)
	);

const markServerPostAsHavingLocalCopy: FileParamsEffect = (params) =>
	SRTE.modify<State, FileContext>((state) => {
		const sp = state.serverPosts.get(params.serverPath);
		if (sp) {
			sp.hasLocalCopy = true;
		}
		return state;
	});

const checkMD5: FileParamsBuilder = (params) =>
	pipe(
		SRTE.ask<State, FileContext>(),
		SRTE.chain(({ serverMd5 }) =>
			serverMd5 && serverMd5 === params.md5
				? SRTE.left({ ...params, status: "SKIP/MD5_MATCH" })
				: SRTE.of(params)
		)
	);

const setEmbeddedAssets: FileParamsBuilder = (params) =>
	pipe(
		SRTE.ask<State, FileContext>(),
		SRTE.chainReaderTaskEitherK(({ file }) => getEmbeddedAssets(file)),
		SRTE.map((embeddedAssets) => ({
			...params,
			embeddedAssets,
		}))
	);

// TODO: test this and clean up
export const processPost = flow(
	setSlug,
	SRTE.chain(checkLocalSlug),
	SRTE.chainFirst(registerLocalSlug),
	SRTE.chain(setServerMD5),
	SRTE.chainFirst(markServerPostAsHavingLocalCopy),
	SRTE.chain(setContentAndMD5),
	SRTE.chain(checkMD5),
	SRTE.chain(setEmbeddedAssets)
)({ status: "PENDING" });

const getAndMaybeUpdateSlug_SRTE: FileParamsBuilder = (params) => {
	return pipe(
		// SRTE.gets((s: State) => s)
		SRTE.ask<State, FileContext>(),
		SRTE.flatMapReaderTaskEither(({ file }) => getAndMaybeUpdateSlug(file)),
		SRTE.map((slug) => ({ ...params, slug })),
		SRTE.chain(flow((e) => SRTE.of({})))
		// SRTE.gets((state: State) => SRTE.of({}))
		// SRTE.fromReaderTaskEither<FileContext, unknown, string, State>
		// SRTE.chain(({ file }) =>
		// 	pipe(
		// 		getAndMaybeUpdateSlug(file),
		// 		SRTE.fromReaderTaskEither<FileContext, unknown, string, State>
		// 	)
		// ),
		// SRTE.map((slug) => ({ ...params, slug })),
		// SRTE.gets((state) => pipe(
		//     SRTE.ask<FileContext>(),
		// ))
	);
};

const getContentAndMD5_RTE: FileParamsBuilder2 = (params) =>
	pipe(
		RTE.ask<FileContext>(),
		RTE.chain(({ file, serverMd5 }) =>
			pipe(
				readPostRTE(file),
				RTE.map((content) => ({
					...params,
					content,
					md5: SparkMD5.hash(content),
				})),
				RTE.chain(({ md5 }) =>
					serverMd5 && serverMd5 === md5
						? RTE.left({ ...params, status: "SKIP/MD5_MATCH" })
						: RTE.of(params)
				)
			)
		)
	);

const getEmbeddedAssets_RTE: FileParamsBuilder2 = (params) =>
	pipe(
		RTE.ask<FileContext>(),
		RTE.chain(({ file }) => getEmbeddedAssets(file)),
		RTE.map((embeddedAssets) => ({
			...params,
			embeddedAssets,
		}))
	);
