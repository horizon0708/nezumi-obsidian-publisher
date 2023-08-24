import { pipe } from "fp-ts/lib/function";
import { Blog } from "src/io/network";
import { loadData, saveData } from "src/io/obsidian-fp";
import * as RTE from "fp-ts/ReaderTaskEither";

type UploadLog = {
	timestamp: string;
	message: string;
	level: "info" | "warning" | "error";
};

type ConnectedBlog = Blog & {
	logs: UploadLog[];
	errorEl: HTMLElement | null;
	message: string;
};

type PluginData = {
	blogs: ConnectedBlog[];
};
type DataUpdater<A> = (a1: A) => (data: PluginData) => PluginData;
type DataUpdaterA2<A, B> = (a1: A, a2: B) => (data: PluginData) => PluginData;

const liftUpdater =
	<A>(updater: DataUpdater<A>) =>
	(a: A) =>
		pipe(loadData, RTE.map(updater(a)), RTE.chain(saveData));
const liftUpdaterA2 =
	<A, B>(updater: DataUpdaterA2<A, B>) =>
	(a: A, b: B) =>
		pipe(loadData, RTE.map(updater(a, b)), RTE.chain(saveData));

const appendLog = (blogId: string, log: UploadLog) => (data: PluginData) => {
	const append = (blog: ConnectedBlog) => {
		if (blog.id !== blogId) {
			return blog;
		}
		return {
			...blog,
			// TODO: implement FIFO for logs
			logs: [...blog.logs, log],
		};
	};

	return {
		...data,
		blogs: data.blogs.map(append),
	};
};
export const appendLogRTE = liftUpdaterA2(appendLog);

const upsertBlog = (blog: Blog, customName?: string) => (data: PluginData) => {
	const ind = data.blogs.findIndex((b) => b.id === blog.id);
	const update = (b: ConnectedBlog) => {
		if (b.id !== blog.id) {
			return b;
		}
		return {
			...b,
			...blog,
			name: customName ?? blog.name,
		};
	};

	if (ind !== -1) {
		return {
			...data,
			blogs: data.blogs.map(update),
		};
	}

	return {
		...data,
		blogs: [
			...data.blogs,
			{
				...blog,
				name: customName ?? blog.name,
				logs: [],
				errorEl: null,
				message: "",
			},
		],
	};
};
export const upsertBlogRTE = liftUpdaterA2(upsertBlog);

const deleteBlog = (blogId: string) => (data: PluginData) => {
	return {
		...data,
		blogs: data.blogs.filter((b) => b.id !== blogId),
	};
};
export const deleteBlogRTE = liftUpdater(deleteBlog);
