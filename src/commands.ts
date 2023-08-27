import { pipe } from "fp-ts/lib/function";
import { PluginContext } from "./actions/types";
import {
	SavedBlog,
	appendLog,
	clearLogs,
	getBlogs,
	printLogs,
} from "./shared/plugin-data";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as RIO from "fp-ts/ReaderIO";
import { upload } from "./actions/upload/upload";
import { showErrorNoticeRTE } from "./shared/notifications";
import { deleteUploadSessionIO } from "./shared/upload-session";
import { buildPluginConfig } from "./plugin-config";

type BlogCommand = (blog: SavedBlog) => RIO.ReaderIO<PluginContext, void>;

export const registerBlogCommands = (
	blogCommands: BlogCommand[] = [
		addBlogUploadCommand,
		stopUploadCommand,
		addDebugLogCommand,
		addDebugLogClearCommand,
		addDebugLogPrint,
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
			deleteUploadSessionIO({ ...ctx })();
		},
	});
};

const addDebugLogCommand = (blog: SavedBlog) => (ctx: PluginContext) => () => {
	ctx.plugin.addCommand({
		id: `xlog-blog-${blog.id}`,
		name: `add test log to ${blog.name}`,
		callback: async () => {
			await appendLog("append log")({
				...ctx,
				blog,
			})();
		},
	});
};

const addDebugLogClearCommand =
	(blog: SavedBlog) => (ctx: PluginContext) => () => {
		ctx.plugin.addCommand({
			id: `xlog-blog-clear-${blog.id}`,
			name: `clear logs for ${blog.name}`,
			callback: async () => {
				await clearLogs(blog.id)({ ...ctx })();
			},
		});
	};

const addDebugLogPrint = (blog: SavedBlog) => (ctx: PluginContext) => () => {
	ctx.plugin.addCommand({
		id: `xlog-blog-print-${blog.id}`,
		name: `print all current logs for ${blog.name}`,
		callback: async () => {
			await printLogs(blog.id)({ ...ctx })();
		},
	});
};
