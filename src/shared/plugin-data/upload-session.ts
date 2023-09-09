import { BlogContext, PluginContextC } from "src/shared/types";
import { pipe } from "fp-ts/lib/function";
import { Log, LogLevel, appendLog, logSchema } from "./upload-session/log";
import { t, RTE, A, IO, O, TE } from "../fp";

export type UploadSession = t.TypeOf<typeof uploadSessionSchema>;

//TODO: statistics
type SessionStats = {
	type: "post" | "asset";
	name:
		| "total"
		| "uploaded"
		| "skip/md5"
		| "skip/slug"
		| "deleted"
		| "error/upload"
		| "error/file"
		| "canceled";
	count: number;
};

export const uploadSessionSchema = t.intersection([
	t.type({
		id: t.string,
		blogId: t.string,
		startedAt: t.string,
		logs: t.array(logSchema),
		uploadCount: t.number,
		errorCount: t.number,
		skipCount: t.number,
		deleteCount: t.number,
		cancelCount: t.number,
	}),
	t.partial({
		finishedAt: t.string,
		cancelledAt: t.string,
	}),
]);

const buildNewUploadSession = (blogId: string): UploadSession => {
	// use iso date for id for now
	return {
		id: new Date().toISOString(),
		blogId,
		startedAt: new Date().toISOString(),
		logs: [],
		uploadCount: 0,
		errorCount: 0,
		skipCount: 0,
		deleteCount: 0,
		cancelCount: 0,
	};
};

export const appendNewUploadSession = (sessions: UploadSession[]) => {
	return pipe(
		RTE.ask<PluginContextC & BlogContext>(),
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
	({ plugin }: PluginContextC): IO.IO<void> =>
	() => {
		plugin.currentUploadSession = null;
	};

export const getUploadSessionIO =
	({ plugin }: PluginContextC): IO.IO<O.Option<UploadSession>> =>
	() => {
		return O.fromNullable(plugin.currentUploadSession);
	};

export const _updateCurrentUploadSession =
	(updatedSession: Partial<UploadSession>) => (sessions: UploadSession[]) =>
		pipe(
			getCurrentUploadSessionIdRTE,
			RTE.map((id) =>
				pipe(
					sessions,
					A.map((session) => {
						return session.id === id
							? { ...session, ...updatedSession }
							: session;
					})
				)
			)
		);

export const getCurrentUploadSessionIdRTE = ({ plugin }: PluginContextC) =>
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
