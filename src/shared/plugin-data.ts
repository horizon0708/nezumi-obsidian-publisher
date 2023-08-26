import * as A from "fp-ts/Array";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { loadData, saveData } from "../io/obsidian-fp";
import * as t from "io-ts";
import { blogSchema } from "../io/network";

const logSchema = t.type({
	timestamp: t.string,
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

const pluginData = t.type({
	blogs: t.array(savedBlogSchema),
});
export type PluginData = t.TypeOf<typeof pluginData>;

const loadPluginData = pipe(
	loadData,
	RTE.chainEitherKW(pluginData.decode),
	RTE.mapLeft(() => new Error("plugin data is corrupted"))
);

const savePluginData = (newData: PluginData) =>
	pipe(
		saveData(newData),
		RTE.mapLeft(() => new Error("Could not save plugin data"))
	);

export const deleteBlog = (id: string) =>
	pipe(
		RTE.Do,
		RTE.apSW("data", loadPluginData),
		RTE.bindW("blogs", ({ data: { blogs } }) =>
			pipe(
				blogs,
				A.findIndex((blog: SavedBlog) => blog.id === id),
				(e) => {
					console.log(e);
					return e;
				},
				O.chain((ind) => A.deleteAt(ind)(blogs)),
				RTE.fromOption(() => new Error("blog not found"))
			)
		),
		RTE.tap(({ data, blogs }) => savePluginData({ ...data, blogs }))
	);

// NEXT TODO: upsert
export const upsertBlog = (blog: SavedBlog) =>
	pipe(
		loadPluginData,
		RTE.map(({ blogs }) => {
			return pipe(
				blogs,
				A.map((b) => (b.id === blog.id ? blog : b)),
				(updateBlogs) =>
					updateBlogs.findIndex((b) => b.id === blog.id) === -1
						? A.append(blog)(updateBlogs)
						: updateBlogs,
				(blogs) => ({ blogs })
			);
		}),
		RTE.tap(savePluginData)
	);

export const getBlog = (id: string) =>
	pipe(
		loadPluginData,
		RTE.chainW((data) =>
			pipe(
				data.blogs,
				A.findFirst((blog: SavedBlog) => blog.id === id),
				RTE.fromOption(() => new Error("blog not found"))
			)
		)
	);

export const getBlogs = pipe(
	loadPluginData,
	RTE.map((data) => data.blogs as SavedBlog[])
);
