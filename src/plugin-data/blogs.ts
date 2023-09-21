import { A, O, RTE, flow, pipe } from "src/shared/fp";
import { loadPluginData, modifyPluginData } from "./plugin-data";
import { SavedBlog } from "./types";

const saveBlogChanges = (cb: (blogs: SavedBlog[]) => SavedBlog[]) =>
	modifyPluginData((data) => ({
		...data,
		blogs: cb(data.blogs),
	}));

// deletes
const deleteById = (id: number) => (blogs: SavedBlog[]) =>
	pipe(
		blogs,
		A.findIndex((blog: SavedBlog) => blog.id === id),
		O.chain((ind) => A.deleteAt(ind)(blogs)),
		O.getOrElse(() => blogs)
	);

export const deleteBlog = flow(deleteById, saveBlogChanges);

// TODO limit number to 7
const upsert = (blog: SavedBlog) => (blogs: SavedBlog[]) =>
	pipe(
		blogs,
		A.map((b) => (b.id === blog.id ? blog : b)),
		(updateBlogs) =>
			updateBlogs.findIndex((b) => b.id === blog.id) === -1
				? A.append(blog)(updateBlogs)
				: updateBlogs
	);

export const upsertBlog = flow(upsert, saveBlogChanges);

// getters
export const getBlogs = pipe(
	loadPluginData(),
	RTE.map((data) => data.blogs)
);

const getById = (id: number) => (blogs: SavedBlog[]) =>
	pipe(
		blogs,
		A.findFirst((blog) => blog.id === id),
		RTE.fromOption(() => new Error(`Blog with id ${id} not found`))
	);

export const getBlogById = flow(getById, RTE.of, RTE.ap(getBlogs), RTE.flatten);
