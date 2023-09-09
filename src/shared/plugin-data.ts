import { loadData, saveData } from "./obsidian-fp";
import * as B from "./plugin-data/blog";
import { BlogContext, PluginContextC } from "./types";
import { A, RT, RTE, TE, pipe, t } from "./fp";
import {
	UploadSessionBuilder,
	sessionSchema,
} from "./plugin-data/upload-session-2";

const pluginData = t.type({
	blogs: t.array(B.savedBlogSchema),
	uploadSessions: t.array(sessionSchema),
});
export type PluginData = t.TypeOf<typeof pluginData>;

const loadPluginData = () =>
	pipe(
		loadData,
		RTE.chainEitherKW(pluginData.decode),
		RTE.mapLeft((e) => {
			console.error(e);
			return new Error("plugin data is corrupted");
		})
	);

const savePluginData = (newData: PluginData) =>
	pipe(
		saveData(newData),
		RTE.mapLeft((e) => {
			console.error(e);
			return new Error("Could not save plugin data");
		})
	);

const defaultData: PluginData = { blogs: [], uploadSessions: [] };
export const maybeInitialisePluginData = (seed: PluginData = defaultData) => {
	return pipe(
		loadData,
		RTE.map((data) => {
			return !data ? seed : data;
		}),
		RTE.chain(saveData)
	);
};

export const clearPluginData = () => pipe(saveData(null));

// ----------------
// Blogs
// ----------------
export const deleteBlog = (id: string) =>
	pipe(
		RTE.Do,
		RTE.apSW("data", loadPluginData()),
		RTE.bindW("blogs", ({ data: { blogs } }) =>
			pipe(
				B.deleteBlog(blogs, id),
				RTE.fromOption(() => new Error("blog not found"))
			)
		),
		RTE.tap(({ data, blogs }) => savePluginData({ ...data, blogs }))
	);

export const upsertBlog = (blog: B.SavedBlog) =>
	pipe(
		loadPluginData(),
		RTE.map(({ blogs, ...rest }) => {
			return {
				blogs: B.upsertBlog(blogs, blog),
				...rest,
			};
		}),
		RTE.tap(savePluginData)
	);

export const getBlogById = (id: string) =>
	pipe(
		loadPluginData(),
		RTE.chainW((data) =>
			pipe(
				B.getBlog(data.blogs, id),
				RTE.fromOption(() => new Error("blog not found"))
			)
		)
	);

// get blog from env
export const getCurrentBlog = () =>
	pipe(
		RTE.ask<BlogContext>(),
		RTE.chainW(({ blog }) => getBlogById(blog.id))
	);

export const getBlogs = pipe(
	loadPluginData(),
	RTE.map((data) => data.blogs as B.SavedBlog[])
);

// ----------------
// sessions
// ----------------
export const saveUploadSession = (session: UploadSessionBuilder) =>
	pipe(
		loadPluginData(),
		RTE.map((pluginData) => ({
			...pluginData,
			uploadSessions: pluginData.uploadSessions.concat([
				session.toJSON(),
			]),
		})),
		RTE.chain(savePluginData)
	);

export const getBlogUploadSessions = (blogId: string) =>
	pipe(
		loadPluginData(),
		RTE.map((pluginData) =>
			pluginData.uploadSessions.filter(
				(session) => session.blogId == blogId
			)
		)
	);

export const clearUploadSessions = pipe(
	loadPluginData(),
	RTE.map((pluginData) => ({
		...pluginData,
		uploadSessions: [],
	})),
	RTE.chainW(savePluginData)
);

// ----------------
// logs
// ----------------
export const getLogsForSession = (sessionId: string) =>
	pipe(
		loadPluginData(),
		RTE.chainW((pluginData) =>
			pipe(
				pluginData.uploadSessions,
				A.findFirst((session) => session.id === sessionId),
				RTE.fromOption(() => new Error("session not found")),
				RTE.map((session) => session.logs)
			)
		)
	);

//  ----------
//  Re exports
//  ----------

export type { SavedBlog } from "./plugin-data/blog";
export type { Log, LogLevel } from "./plugin-data/upload-session/log";
