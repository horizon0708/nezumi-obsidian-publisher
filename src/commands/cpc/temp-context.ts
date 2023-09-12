import { RTE, pipe } from "src/shared/fp";
/**
 * Higher order function returns a function that "injects" the passed in variable as a dependency
 * in the ReaderTaskEither monad. The injected dependency is removed after the monad is run.
 *
 * Is this being too clever? I don't know 🤷‍♂️... It does reduce a lot of the curried functions.
 */
export const resolveLocalDeps =
	<R2>() =>
	<R1, E, A>(rte: RTE.ReaderTaskEither<R1 & { args: R2 }, E, A>) =>
	(r2: R2) => {
		return pipe(
			RTE.ask<R1>(),
			RTE.flatMapTaskEither((a) => rte({ ...a, args: r2 }))
		);
	};

export type LocalDeps<R2> = { args: R2 };

export const askLocalDeps = <R2>() => RTE.ask<{ args: R2 }>();

export const resolveLocalDepsK =
	<R2>() =>
	<R1, E, A, B>(rteK: (a: A) => RTE.ReaderTaskEither<R1 & R2, E, B>) =>
	(r2: R2) => {
		return (a: A) =>
			pipe(
				RTE.ask<R1>(),
				RTE.flatMapTaskEither((r1) => rteK(a)({ ...r1, ...r2 }))
			);
	};
