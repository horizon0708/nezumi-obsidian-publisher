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
			left: [...x.left, ...y.left],
			right: [...x.right, ...y.right],
		};
	},
	empty: {
		left: [],
		right: [],
	},
	fromLeft: (e: E) => ({
		left: [e],
		right: [],
	}),
	fromRight: (a: A) => ({
		left: [],
		right: [a],
	}),
});
