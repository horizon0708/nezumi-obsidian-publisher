import { flow } from "fp-ts/lib/function";
import { DecodeError } from "../errors";
import { A, E, R, RTE, TE, pipe, t } from "../fp";
import { fetchUrl } from "../obsidian-fp";
import { BlogContext, PluginConfigContext } from "../types";
import { concatAll } from "fp-ts/lib/Monoid";
import { errorResultM, successResultM, resultM } from "../utils";

export const serverFile = t.type({
	md5: t.string,
	slug: t.string,
});

export type ServerFile = t.TypeOf<typeof serverFile>;

export const getFetchEnv = R.asks((d: BlogContext & PluginConfigContext) => ({
	baseUrl: d.blog.endpoint,
	apiKey: d.blog.apiKey,
	apiKeyHeader: d.pluginConfig.apiKeyHeader,
}));

export const jsonContentType = { ["Content-Type"]: "application/json" };

export enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
}

export const sendRequest = <T extends t.Props>(decoder: t.TypeC<T>) =>
	flow(
		fetchUrl,
		TE.chainEitherKW((res) =>
			pipe(
				decoder.decode(res.json),
				E.mapLeft(
					(errors) =>
						new DecodeError(
							errors,
							"Server response does not match schema. Please try updating the plugin."
						)
				)
			)
		)
	);

export const createServerMap = (serverFiles: ServerFile[]) => {
	const serverMap = new Map<string, string>();
	serverFiles.forEach(({ slug, md5 }) => {
		if (slug) {
			serverMap.set(slug, md5);
		}
	});
	return serverMap;
};

export const buildUploadMany =
	<T, R, A>(rte: (t: T) => RTE.ReaderTaskEither<R, Error, A>) =>
	(items: T[]) =>
		pipe(
			items,
			A.map((p) =>
				pipe(
					rte(p),
					RTE.bimap(
						() => errorResultM(p),
						() => successResultM<T, T>(p)
					)
				)
			),
			// sequentially for now. Look into batching later
			RTE.sequenceSeqArray,
			RTE.map(concatAll(resultM())),
			RTE.map(([uploaded, errored]) => ({ uploaded, errored }))
		);
