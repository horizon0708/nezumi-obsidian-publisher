import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as s from "fp-ts/struct";
import { flow, pipe } from "fp-ts/function";
import { pluginConfig } from "./plugin-config";
import * as A from "fp-ts/Array";
import * as R from "fp-ts/Record";
import * as RIO from "fp-ts/ReaderIO";
import { get } from "http";

type TestContext = {
	a: "a";
};

const ri1 = pipe(RTE.ask<TestContext & { b: "b" }>());
// loses the typing...

export const readerInjection = (b: "b") =>
	pipe(
		RTE.ask<TestContext>(),
		RTE.chain(
			// (ctx) => RTE.of("what")
			(ctx) =>
				pipe(
					RTE.of("what")({ ...ctx, b: b }),
					RTE.fromTaskEither<never, string, TestContext>
				)
		),
		RTE.map((e) => {
			return e;
		}),
		RTE.chain((e) => pipe(RTE.asks((env) => console.log("outer env", env))))
		// RTE.chain((ctx) => pipe(ri1({ ...ctx, file }), RTE.fromTaskEither))
	);

export const sampleRte = RTE.of("hi");
RTE.apS;

const ri2 = <R1, R2>(r2: R2) =>
	pipe(
		RTE.ask<R1>(),
		RTE.chainFirst((a) => pipe(RTE.of("a")(r2), RTE.fromTaskEither))
	);

export const readerInjection2 =
	<R1, R2, E, A>(fn: RTE.ReaderTaskEither<R2, E, A>) =>
	(b: R2) =>
		pipe(
			RTE.ask<R1, E>(),
			RTE.chainW(
				// (ctx) => RTE.of("what")
				(ctx) =>
					pipe(fn({ ...ctx, ...b }), RTE.fromTaskEither<E, A, R1>)
			),
			(d) => d
			// RTE.map((e) => {
			// 	return e;
			// }),
			// RTE.chain((e) =>
			// 	pipe(RTE.asks((env) => console.log("outer env", env)))
			// )
			// RTE.chain((ctx) => pipe(ri1({ ...ctx, file }), RTE.fromTaskEither))
		);

const e = readerInjection2(sampleRte)({ b: "b" });

const f = pipe(
	RTE.ask<TestContext>(),
	RTE.chain((e) => readerInjection2(sampleRte)({ b: "b" })),
	RTE.chain((e) => RTE.of("e"))
);

type WithFile = { file: "b" };
const getSlugFromFrontmatter2 = <T extends WithFile>({ file }: T) =>
	RTE.asks(
		({ app }) =>
			(app.metadataCache.getFileCache(file)?.frontmatter?.[
				pluginConfig.slugKey
			] ?? "") as string
	);

const getDefaultSlugFromFile2 = <T extends WithFile>({ file }: T) =>
	RTE.asks(
		({ app }) =>
			(app.metadataCache.getFileCache(file)?.frontmatter?.[
				pluginConfig.slugKey
			] ?? "") as string
	);

/**
 * Gets slug for the TFile, and updates TFile's frontmatter if necessary
 * before do notation
 */
// export const getAndMaybeUpdateSlug = (file: TFile) =>
// pipe(
//     // NEXT: Use DO notation is to make this way simpler
//     [getSlugFromFrontmatter, getDefaultSlugFromFile],
//     A.map((f) => f(file)),
//     RTE.sequenceArray,
//     RTE.tap(([fmSlug, defaultSlug]) => {
//         if (fmSlug === "") {
//             return updateSlug(file, defaultSlug);
//         }
//         return RTE.of(undefined);
//     }),
//     RTE.map(([fmSlug, defaultSlug]) => {
//         return fmSlug === "" ? defaultSlug : fmSlug;
//     })
// );

type R1 = { a: "a" };
type R2 = { b: "b" };
type R3 = { c: 3 };
const needsR2 = (r2: R2) => TE.of(1);
// needsR3 shouldn't compile
const needsR3 = (r3: R3) => TE.of(1);

const b = (r2: R2) =>
	RTE.asksReaderTaskEitherW((f: R1) =>
		pipe(needsR2({ ...f, ...r2 }), RTE.fromTaskEither)
	);

// is same as
const c = (r2: R2) =>
	pipe(
		RTE.ask<TestContext>(),
		RTE.chainW((f) => pipe(needsR2({ ...f, ...r2 }), RTE.fromTaskEither))
	);

// is same as
const d = (r2: R2) =>
	pipe(
		(e: R1) => RTE.fromTaskEither(needsR2({ ...e, ...r2 })),
		RTE.asksReaderTaskEitherW
	);

// is same as

const d2 = (r2: R2) =>
	pipe(
		(e: R1) => pipe(needsR2({ ...e, ...r2 }), RTE.fromTaskEither),
		RTE.asksReaderTaskEitherW
	);

type NS = <E, A>(r1: R1) => RTE.ReaderTaskEither<R2, E, A>;
const fn1 =
	(r2: R2) =>
	<E, A>(fn: RTE.ReaderTaskEither<R2, E, A>) =>
	(r1: R1) =>
		RTE.fromTaskEither<E, A, R1>(fn({ ...r1, ...r2 }));

const combineDeps =
	<T>(fn: (r2: R2) => T) =>
	(r2: R2) =>
	(e: R1) => {
		return fn({
			...e,
			...r2,
		});
	};
