import { A, Separated, Monoid, semigroup } from "src/shared/fp";

export type ResultsWithErrors<A> = { errors: Error[]; values: A[] };

export const separateErrors = <A>(results: (A | Error)[]) => {
	return results.reduce<ResultsWithErrors<A>>(
		(acc, curr) => {
			if (curr instanceof Error) {
				return { ...acc, errors: [...acc.errors, curr] };
			}
			return { ...acc, values: [...acc.values, curr] };
		},
		{ errors: [], values: [] }
	);
};

export const separatedSemigroup = <E, A>() =>
	semigroup.struct<Separated.Separated<E[], A[]>>({
		left: A.getSemigroup<E>(),
		right: A.getSemigroup<A>(),
	});
