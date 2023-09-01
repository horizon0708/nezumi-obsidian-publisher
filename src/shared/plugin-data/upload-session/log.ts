import { t } from "src/shared/fp";

export type Log = t.TypeOf<typeof logSchema>;
export type LogLevel = t.TypeOf<typeof logLevelSchema>;

export const logLevelSchema = t.keyof({
	debug: null,
	info: null,
	warning: null,
	error: null,
});

export const logSchema = t.type({
	timestamp: t.string,
	message: t.string,
	level: t.keyof({
		debug: null,
		info: null,
		warning: null,
		error: null,
	}),
});

// shouldn't need truncate anymore as sessions gets shifted
export const appendLog = (message: string, level: LogLevel) => (logs: Log[]) =>
	[
		...logs,
		{
			timestamp: new Date().toISOString(),
			message,
			level,
		},
	];

export const newLog = (message: string, level: LogLevel = "info") => ({
	timestamp: new Date().toISOString(),
	message,
	level,
});
