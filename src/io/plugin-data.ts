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
import { SavedBlog } from "../settings-new/saved-blog";

export const deleteBlog = (id: string) =>
	pipe(
		RTE.Do,
		RTE.apS("data", loadData),
		// TODO: Decode using io-ts
		RTE.let("blogs", ({ data: { blogs } }) =>
			pipe(
				blogs,
				A.findIndex((blog: SavedBlog) => blog.id === id),
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
export const addBlog = (blog: SavedBlog) =>
	pipe(
		loadData,
		RTE.map((data) => ({
			...data,
			blogs: A.append(blog)(data.blogs),
		})),
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
