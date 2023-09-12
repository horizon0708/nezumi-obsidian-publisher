import { E, RE, RTE, pipe } from "src/shared/fp";
import { getPosts, getAssets } from "src/shared/network-new";
import { filterCandidates } from "./filter-candidates";
import { getCandidates } from "./get-candidates";
import { Manifest } from "./shared/manifest";
import {
	AppContext,
	BlogContext,
	PluginConfigContext,
	PluginContextC,
} from "src/shared/types";
import { ConfirmationModal } from "./confirmation-modal";
import { buildUpload } from "./build-upload";

type Context = AppContext & BlogContext & PluginConfigContext & PluginContextC;
export const cpc = async (ctx: Context) => {
	const result = await pipe(
		getCandidates(),
		RE.bindTo("candidates"),
		RTE.fromReaderEither,
		RTE.bindW("manifest", () => createManifest),
		RTE.bindW("filteredCandidates", filterCandidates),
		RTE.map(({ manifest, filteredCandidates }) => ({
			...filteredCandidates,
			manifest,
		}))
	)(ctx)();

	if (E.isRight(result)) {
		const onUpload = async () => {
			try {
				const res = await buildUpload(result.right)(ctx)();
			} catch (e) {
				console.log(e);
				// TODO: show another modal
			}
		};
		const modal = new ConfirmationModal(ctx.app, ctx.plugin);
		modal.render({ ...result.right, onUpload });
		modal.open();
	}
	// TODO: show modal on error too
};

const createManifest = pipe(
	RTE.Do,
	RTE.apSW("posts", getPosts),
	RTE.apSW("assets", getAssets),
	RTE.map(({ posts, assets }) => new Manifest(posts, assets))
);
