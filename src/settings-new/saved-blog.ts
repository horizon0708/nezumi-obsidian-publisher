import * as t from "io-ts";
import { blogSchema } from "../io/network";

const logSchema = t.type({
	message: t.string,
});

const blogClientData = t.type({
	apiKey: t.string,
	endpoint: t.string,
	syncFolder: t.string,
	logs: t.array(logSchema),
});

const savedBlogSchema = t.intersection([blogSchema, blogClientData]);

export type SavedBlog = t.TypeOf<typeof savedBlogSchema>;
