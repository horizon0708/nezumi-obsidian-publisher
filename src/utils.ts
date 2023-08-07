import { Monoid } from "fp-ts/lib/Monoid";

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
