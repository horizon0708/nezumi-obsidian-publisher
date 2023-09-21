import { pipe } from "fp-ts/lib/function";
import { AppContext, PluginContextC } from "./shared/types";
import {
	SavedBlog,
	clearPluginData,
	clearUploadSessions,
	getBlogs,
} from "./shared/plugin-data";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as RIO from "fp-ts/ReaderIO";
import { showErrorNoticeRTE } from "./shared/obsidian-fp/notifications";
import { pushChanges } from "./commands/push-changes";
import { DEFAULT_CONFIG } from "./shared/plugin-data/plugin-config";

type BlogCommandContext = AppContext & PluginContextC;

type PluginCommand = RIO.ReaderIO<PluginContextC, void>;
type BlogCommand = (blog: SavedBlog) => RIO.ReaderIO<BlogCommandContext, void>;

export const registerBlogCommands = (
	blogCommands: BlogCommand[] = [addBlogUploadCommand, stopUploadCommand]
) => {
	const addCommands = (blog: SavedBlog) =>
		pipe(
			blogCommands,
			A.map((fn) => fn(blog))
		);

	return pipe(
		getBlogs,
		RTE.chainW((blogs) =>
			pipe(
				blogs,
				A.map(addCommands),
				A.flatten,
				RIO.sequenceArray,
				RTE.rightReaderIO
			)
		),
		RTE.tapError(showErrorNoticeRTE)
	);
};
export const registerDebugBlogCommands = () => {
	return registerBlogCommands([addDebugSessionClearCommand, addGeneralDebug]);
};

export const registerPluginCommands = (
	commands: PluginCommand[] = [clearAllData]
) => {
	return pipe(
		commands,
		RIO.sequenceArray,
		RTE.rightReaderIO,
		RTE.tapError(showErrorNoticeRTE)
	);
};

export const registerDebugPluginCommands = () => {
	return registerPluginCommands([]);
};

const addBlogUploadCommand =
	(blog: SavedBlog) => (ctx: BlogCommandContext) => () => {
		ctx.plugin.addCommand({
			id: `test-upload-blog-${blog.id}`,
			name: `Test upload ${blog.name}`,
			callback: async () => {
				await pushChanges({
					...ctx,
					blog,
					pluginConfig: DEFAULT_CONFIG,
				});
			},
		});
	};

const stopUploadCommand = (blog: SavedBlog) => (ctx: PluginContextC) => () => {
	ctx.plugin.addCommand({
		id: `stop-upload-blog-${blog.id}`,
		name: `Stop upload ${blog.name}`,
		// TODO: check callback
		callback: () => {
			ctx.plugin.currentSessionId = null;
		},
	});
};

const addDebugSessionClearCommand =
	(blog: SavedBlog) => (ctx: PluginContextC) => () => {
		ctx.plugin.addCommand({
			id: `debug-blog-session-clear-${blog.id}`,
			name: `clear all sessions`,
			callback: async () => {
				await clearUploadSessions({ ...ctx })();
			},
		});
	};

const addGeneralDebug =
	(blog: SavedBlog) => (ctx: BlogCommandContext) => () => {
		ctx.plugin.addCommand({
			id: `debug-${blog.id}`,
			name: `Debug it up! ${blog.name}`,
			callback: async () => {},
		});
	};

const clearAllData: PluginCommand = (ctx: PluginContextC) => () => {
	ctx.plugin.addCommand({
		id: `debug-clear-all-data`,
		name: `DEBUG clear all data`,
		callback: async () => {
			await clearPluginData()({ ...ctx })();
			console.log("cleared all plugin data:");
			console.log(await ctx.plugin.loadData());
		},
	});
};
