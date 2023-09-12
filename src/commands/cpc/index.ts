import { flip, pipe } from "fp-ts/lib/function";
import { E, RE, RTE } from "src/shared/fp";
import { getPosts, getAssets } from "src/shared/network-new";
import { filterCandidates } from "./filter-candidates";
import { getCandidates } from "./get-candidates";
import { Manifest } from "../confirm-push-changes/plan-upload/manifest";
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
		RTE.bindW("filteredCandidates", ({ candidates, manifest }) =>
			filterCandidates(manifest)(candidates)
		),
		RTE.map(({ manifest, filteredCandidates }) => ({
			...filteredCandidates,
			manifest,
		}))
	)(ctx)();

	console.log(result);
	if (E.isRight(result)) {
		const onUpload = async () => {
			console.log("called");
			try {
				const res = await buildUpload(result.right)(ctx)();
				console.log(res);
			} catch (e) {
				console.log(e);
			}
		};
		const modal = new ConfirmationModal(ctx.app, ctx.plugin);
		modal.render({ ...result.right, onUpload });
		modal.open();
	}
};

const createManifest = pipe(
	RTE.Do,
	RTE.apSW("posts", getPosts),
	RTE.apSW("assets", getAssets),
	RTE.map(({ posts, assets }) => new Manifest(posts, assets))
);
