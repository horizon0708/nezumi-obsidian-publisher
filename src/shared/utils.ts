import * as TE from "fp-ts/TaskEither";

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
