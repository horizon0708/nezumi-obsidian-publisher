import { pipe } from "fp-ts/lib/function";
import { PluginContext } from "./actions/types";
import { SavedBlog, getBlogs } from "./io/plugin-data";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as A from "fp-ts/Array";
import * as RIO from "fp-ts/ReaderIO";
import { upload } from "./actions/upload/upload";
import { showNotice } from "./io/obsidian-fp";

export const registerPushUpdateCommand = () =>
	pipe(
		getBlogs,
		RTE.chainW((blogs) =>
			pipe(
				blogs,
				A.map(addBlogCommand),
				RIO.sequenceArray,
				RTE.rightReaderIO
			)
		),
		RTE.tapError(showErrorNotice)
	);

const addBlogCommand = (blog: SavedBlog) => (ctx: PluginContext) => () => {
	console.log("command added!");
	return ctx.plugin.addCommand({
		id: `test-upload-blog-${blog.id}`,
		name: `Test upload ${blog.name}`,
		callback: async () => {
			await upload({ ...ctx, blog });
		},
	});
};

const showErrorNotice = RTE.fromIOK((e: Error) => () => showNotice(e.message));
