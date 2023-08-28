import { Monoid } from "fp-ts/lib/Monoid";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as RE from "fp-ts/ReaderEither";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as R from "fp-ts/Reader";
import * as T from "fp-ts/Task";
import { FileType } from "./types";

type ResultMonoid<E, A> = [A[], E[]];

export const successResultM = <E, A>(result: A): ResultMonoid<E, A> => [
	[result],
	[],
];
export const errorResultM = <E, A>(result: E): ResultMonoid<E, A> => [
	[],
	[result],
];
// There must be a existing monoid similar to this
export const resultM = <E, A>(): Monoid<ResultMonoid<E, A>> => ({
	concat: (x, y) => {
		const [xSuccess, xError] = x;
		const [ySuccess, yError] = y;
		return [
			[...xSuccess, ...ySuccess],
			[...xError, ...yError],
		];
	},
	empty: [[], []],
});

export const liftRightRTE = <R, A, B>(
	f: (a: A) => B
): ((a: A) => RTE.ReaderTaskEither<R, never, B>) => {
	return (a: A) => RTE.right(f(a));
};

export const liftRightRE = <R, A, B>(
	f: (a: A) => B
): ((a: A) => RE.ReaderEither<R, never, B>) => {
	return (a: A) => RE.right(f(a));
};

export const liftRightE = <A, B>(
	f: (a: A) => B
): ((a: A) => E.Either<never, B>) => {
	return (a: A) => E.right(f(a));
};

export const liftRT =
	<R, A, B>(f: (a: A) => B): ((a: A) => RT.ReaderTask<R, B>) =>
	(a: A) =>
		RT.of(f(a));

export const liftT = <A, B>(f: (a: A) => B): ((a: A) => T.Task<B>) => {
	return (a: A) => T.of(f(a));
};

export const liftR =
	<R, A, B>(fn: (t: A) => B) =>
	(a: A) =>
		R.of<R, B>(fn(a));

// IMPROVE: Loses the context in browser console
export const teeRTE = RTE.tapIO((e) => {
	return () => console.log(JSON.stringify(e));
});

export const getType = (path: string) =>
	path.endsWith(".md") ? FileType.POST : FileType.ASSET;

const delay = (ms: number) =>
	new Promise<void>((resolve) => {
		console.log(`setting debug delay to ${ms}ms!`);
		return setTimeout(() => {
			resolve();
		}, ms);
	});

export const delayTE = (ms: number): TE.TaskEither<never, void> =>
	TE.tryCatch(
		() => delay(ms),
		() => new Error(`Failed to delay ${ms}ms`) as never
	);
