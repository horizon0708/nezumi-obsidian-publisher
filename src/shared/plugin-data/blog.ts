import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { blogSchema } from "src/shared/network";
import * as A from "fp-ts/Array";
import * as O from "fp-ts/Option";

export type SavedBlog = t.TypeOf<typeof savedBlogSchema>;

const blogClientData = t.type({
	apiKey: t.string,
	endpoint: t.string,
	syncFolder: t.string,
});

export const savedBlogSchema = t.intersection([blogSchema, blogClientData]);

export const deleteBlog = (blogs: SavedBlog[], id: string) =>
	pipe(
		blogs,
		A.findIndex((blog: SavedBlog) => blog.id === id),
		O.chain((ind) => A.deleteAt(ind)(blogs))
	);

// TODO limit number to 7
export const upsertBlog = (blogs: SavedBlog[], blog: SavedBlog) =>
	pipe(
		blogs,
		A.map((b) => (b.id === blog.id ? blog : b)),
		(updateBlogs) =>
			updateBlogs.findIndex((b) => b.id === blog.id) === -1
				? A.append(blog)(updateBlogs)
				: updateBlogs
	);

export const getBlog = (blogs: SavedBlog[], id: string) =>
	pipe(
		blogs,
		A.findFirst((blog: SavedBlog) => blog.id === id)
	);
