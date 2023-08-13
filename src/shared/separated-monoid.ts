import { Monoid } from "fp-ts/Monoid";
import { Separated } from "fp-ts/Separated";

type Builder<E, A> = {
	fromLeft: (e: E) => Separated<E[], A[]>;
	fromRight: (a: A) => Separated<E[], A[]>;
};
export const separatedMonoid = <E, A>(): Monoid<Separated<E[], A[]>> &
	Builder<E, A> => ({
	concat: (x, y) => {
		return {
			pending: [...x.pending, ...y.pending],
			right: [...x.right, ...y.right],
		};
	},
	empty: {
		pending: [],
		right: [],
	},
	fromLeft: (e: E) => ({
		pending: [e],
		right: [],
	}),
	fromRight: (a: A) => ({
		pending: [],
		right: [a],
	}),
});
