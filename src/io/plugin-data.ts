import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import * as RIO from "fp-ts/ReaderIO";
import * as IO from "fp-ts/IO";
import * as A from "fp-ts/Array";
import * as r from "fp-ts/Record";
import * as rt from "fp-ts/ReadonlyTuple";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import { loadData, saveData } from "./obsidian-fp";

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

export const deleteBlog = (id: string) =>
	pipe(
		RTE.Do,
		RTE.apS("data", pipe(loadData, RTE.chainEitherKW(pluginData.decode))),
		RTE.let("blogs", ({ data: { blogs } }) =>
			pipe(
				blogs,
				A.findIndex((blog: SavedBlog) => blog.id === id),
				(e) => {
					console.log(e);
					return e;
				},
				O.chain((ind) => A.deleteAt(ind)(blogs)),
				O.fold(
					() => blogs,
					(newBlogs) => newBlogs
				)
			)
		),
		RTE.tap(({ data, blogs }) => saveData({ ...data, blogs }))
	);

// NEXT TODO: upsert
export const upsertBlog = (blog: SavedBlog) =>
	pipe(
		loadData,
		RTE.chainEitherKW(pluginData.decode),
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
		RTE.tap(saveData)
	);

export const getBlog = (id: string) =>
	pipe(
		loadData,
		RTE.chainW((data) =>
			pipe(
				data.blogs,
				A.findFirst((blog: SavedBlog) => blog.id === id),
				RTE.fromOption(() => "blog not found")
			)
		)
	);

export const getBlogs = pipe(
	loadData,
	RTE.map((data) => data.blogs as SavedBlog[])
);
