import { BlogContext, PluginContext } from "src/commands/types";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { Log, LogLevel, appendLog, logSchema } from "./upload-session/log";
import * as A from "fp-ts/Array";

export type UploadSession = t.TypeOf<typeof uploadSessionSchema>;

export const uploadSessionSchema = t.type({
	id: t.string,
	blogId: t.string,
	date: t.string,
	logs: t.array(logSchema),
});

const buildNewUploadSession = (blogId: string): UploadSession => {
	// use iso date for id for now
	return {
		id: new Date().toISOString(),
		blogId,
		date: new Date().toISOString(),
		logs: [],
	};
};

export const appendNewUploadSession = (sessions: UploadSession[]) => {
	return pipe(
		RTE.ask<PluginContext & BlogContext>(),
		RTE.chainW(({ plugin, blog }) =>
			pipe(
				buildNewUploadSession(blog.id),
				RTE.of,
				RTE.tapIO((session) => () => {
					plugin.currentUploadSession = session;
				}),
				RTE.map((session) =>
					pipe(sessions, A.append(session), truncateArray(10))
				)
			)
		)
	);
};

export const appendToSessionLog =
	(message: string, logLevel: LogLevel) =>
	(sessions: UploadSession[]) =>
	(sessionId: string) => {
		return sessions.map((session) => {
			if (session.id === sessionId) {
				return {
					...session,
					logs: appendLog(message, logLevel)(session.logs),
				};
			}
			return session;
		});
	};

const truncateArray =
	(maxLength: number) =>
	<A>(arr: A[]) => {
		arr.length > maxLength ? arr.shift() : arr;
		return arr;
	};

export const getSession = (sessionId: string) => (sessions: UploadSession[]) =>
	pipe(
		sessions,
		A.findFirst((session) => session.id === sessionId)
	);

export const deleteCurrentUploadSessionID =
	({ plugin }: PluginContext): IO.IO<void> =>
	() => {
		plugin.currentUploadSession = null;
	};

export const getUploadSessionIO =
	({ plugin }: PluginContext): IO.IO<O.Option<UploadSession>> =>
	() => {
		return O.fromNullable(plugin.currentUploadSession);
	};
export const getCurrentUploadSessionIdRTE = ({ plugin }: PluginContext) =>
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
