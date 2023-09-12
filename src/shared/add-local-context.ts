import { RTE, pipe } from "src/shared/fp";

/**
 * Injects the passed in variable as a dependency in the ReaderTaskEither monad.
 * The passed in dependency is "removed" (i.e. does not widen the Reader type)
 * after the monad is run.
 *
 * This is used to pass in an extra variable as a Reader dependency
 * so that we don't have to pass curry functions around.
 *
 * The dependecy is named `args` so that we don't accidently override
 * the outer reader dependencies.
 */
export const addLocalContext =
	<R2>(r2: R2) =>
	<R1, E, A>(rte: RTE.ReaderTaskEither<R1 & { args: R2 }, E, A>) => {
		return pipe(
			RTE.ask<R1>(),
			RTE.flatMapTaskEither((a) => rte({ ...a, args: r2 }))
		);
	};

export type LocalDeps<R2> = { args: R2 };
