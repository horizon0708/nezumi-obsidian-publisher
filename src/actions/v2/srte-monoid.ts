import * as O from "fp-ts/Option";
import { Monoid } from "fp-ts/lib/Monoid";

type SRTEFoldResult<E, A, S> = {
	left: E[];
	right: A[];
	state: O.Option<S>;
};
export const leftFold = <E, A, S>(e: E): SRTEFoldResult<E, A, S> => ({
	left: [e],
	right: [],
	state: O.none,
});
export const rightFold = <E, A, S>(
	a: A,
	state: S
): SRTEFoldResult<E, A, S> => ({
	left: [],
	right: [a],
	state: O.some(state),
});

export const SRTEMonoid = <E, A, S>(
	stateEmpty: S
): Monoid<SRTEFoldResult<E, A, S>> => ({
	concat: (x, y) => {
		const { left: xLeft, right: xRight, state: xState } = x;
		const { left: yLeft, right: yRight, state: yState } = y;

		return {
			left: [...xLeft, ...yLeft],
			right: [...xRight, ...yRight],
			state: O.isSome(yState) ? yState : xState,
		};
	},
	empty: {
		left: [],
		right: [],
		state: O.some(stateEmpty),
	},
});
