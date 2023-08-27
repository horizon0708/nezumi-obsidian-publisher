import { PluginContext } from "src/actions/types";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

export type UploadSession = {
	id: string;
	date: string;
};

const buildNewUploadSession = () => {
	// use iso date for id for now
	return {
		id: new Date().toISOString(),
		date: new Date().toISOString(),
	};
};

export const setNewUploadSessionIO =
	({ plugin }: PluginContext): IO.IO<UploadSession> =>
	() => {
		plugin.currentUploadSession = buildNewUploadSession();
		return plugin.currentUploadSession;
	};

export const deleteUploadSessionIO =
	({ plugin }: PluginContext): IO.IO<void> =>
	() => {
		plugin.currentUploadSession = null;
	};

export const getUploadSessionIO =
	({ plugin }: PluginContext): IO.IO<O.Option<UploadSession>> =>
	() => {
		return O.fromNullable(plugin.currentUploadSession);
	};
export const getUploadSessionIdRTE = ({ plugin }: PluginContext) =>
	pipe(
		// Investigate: how does this work when wrapped in a promise?
		// I have a vague intuition on why it works, but want to confirm it.
		TE.tryCatch(
			() => plugin.currentSession(),
			() => new Error("No upload session found")
		),
		TE.chain(TE.fromNullable(new Error("No upload session found"))),
		TE.map((session) => {
			return session.id;
		})
	);
