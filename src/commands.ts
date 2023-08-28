import { pipe } from "fp-ts/lib/function";
import { PluginContext } from "./shared/types";
import {
	SavedBlog,
	clearPluginData,
	clearUploadSessions,
	getBlogs,
} from "./shared/plugin-data";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as RIO from "fp-ts/ReaderIO";
import { upload } from "./commands/upload";
import { showErrorNoticeRTE } from "./shared/notifications";
import { deleteCurrentUploadSessionID } from "./shared/plugin-data/upload-session";

type BlogCommand = (blog: SavedBlog) => RIO.ReaderIO<PluginContext, void>;
type PluginCommand = RIO.ReaderIO<PluginContext, void>;

export const registerBlogCommands = (
	blogCommands: BlogCommand[] = [
		addBlogUploadCommand,
		stopUploadCommand,
		addDebugSessionClearCommand,
	]
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

export const registerPluginCommands = (
	commands: PluginCommand[] = [debugClearAllData]
) => {
	return pipe(
		commands,
		RIO.sequenceArray,
		RTE.rightReaderIO,
		RTE.tapError(showErrorNoticeRTE)
	);
};

const addBlogUploadCommand =
	(blog: SavedBlog) => (ctx: PluginContext) => () => {
		ctx.plugin.addCommand({
			id: `test-upload-blog-${blog.id}`,
			name: `Test upload ${blog.name}`,
			callback: async () => {
				await upload({ ...ctx, blog });
			},
		});
	};

const stopUploadCommand = (blog: SavedBlog) => (ctx: PluginContext) => () => {
	ctx.plugin.addCommand({
		id: `stop-upload-blog-${blog.id}`,
		name: `Stop upload ${blog.name}`,
		// TODO: check callback
		callback: () => {
			deleteCurrentUploadSessionID({ ...ctx })();
		},
	});
};

const addDebugSessionClearCommand =
	(blog: SavedBlog) => (ctx: PluginContext) => () => {
		ctx.plugin.addCommand({
			id: `debug-blog-session-clear-${blog.id}`,
			name: `clear all sessions`,
			callback: async () => {
				await clearUploadSessions({ ...ctx })();
			},
		});
	};

const debugClearAllData: PluginCommand = (ctx: PluginContext) => () => {
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
