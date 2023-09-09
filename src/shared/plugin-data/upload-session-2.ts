import BlogSync from "main";
import { BlogContext, PluginContextC, SessionStats } from "../types";
import { Log, LogLevel, logSchema } from "./upload-session/log";
import { R, pipe, t } from "../fp";
import { log } from "fp-ts/lib/Console";

/**
 * Mutable data structure to track various stats around session.
 */
export class UploadSessionBuilder {
	id: string;
	blogId: string;
	startedAt: string;
	logs: Log[] = [];
	finishedAt?: string;
	cancelledAt?: string;
	stats: SessionStats[] = [];
	plugin: BlogSync;

	constructor(plugin: BlogSync, blogId: string) {
		// use iso date for id for now
		this.id = new Date().toISOString();
		this.startedAt = new Date().toISOString();
		this.blogId = blogId;
		this.plugin = plugin;
	}

	appendLog(message: string, level: LogLevel = "info") {
		const maxLength = 1000;
		this.logs.push({ timestamp: new Date().toISOString(), message, level });
		if (this.logs.length > maxLength) {
			this.logs.shift();
		}
	}

	toJSON() {
		return {
			id: this.id,
			blogId: this.blogId,
			startedAt: this.startedAt,
			finishedAt: this.finishedAt,
			cancelledAt: this.cancelledAt,
			stats: this.stats,
			logs: this.logs,
		};
	}
}

export type UploadSession = t.TypeOf<typeof sessionSchema>;

export const sessionSchema = t.type({
	id: t.string,
	blogId: t.string,
	startedAt: t.string,
	logs: t.array(logSchema),
	stats: t.array(t.any),
});

export const newUploadSession = () =>
	pipe(
		R.ask<BlogContext & PluginContextC>(),
		R.map(({ plugin, blog }) => new UploadSessionBuilder(plugin, blog.id))
	);
