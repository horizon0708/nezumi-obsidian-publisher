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
import { buildCalloutMarkdown } from "./confirmation-modal/build-callout-markdown";

type Context = AppContext & BlogContext & PluginConfigContext & PluginContextC;
export const pushChanges = async (ctx: Context) => {
	const result = await pipe(
		getCandidates(),
		RE.bindTo("candidates"),
		RTE.fromReaderEither,
		RTE.bindW("manifest", () => createManifest),
		RTE.bindW("filteredCandidates", filterCandidates),
		RTE.map(({ manifest, filteredCandidates }) => ({
			...filteredCandidates,
			manifest,
		})),
		RTE.let("markdown", buildCalloutMarkdown)
	)(ctx)();

	if (E.isRight(result)) {
		console.log(result.right);
		const onUpload = async () => {
			try {
				const res = await buildUpload(result.right)(ctx)();
				console.log(res);
			} catch (e) {
				console.error(e);
				// TODO: show another modal
			}
		};
		const modal = new ConfirmationModal(ctx.app, ctx.plugin);
		const showUpload =
			!!result.right.right.length ||
			!!result.right.manifest.getItemsToDelete.posts.length ||
			!!result.right.manifest.getItemsToDelete.assets.length;

		modal.render({ markdown: result.right.markdown, onUpload, showUpload });
		modal.open();
	} else {
		console.error(result.left);
		const modal = new ConfirmationModal(ctx.app, ctx.plugin);
		const markdown = `
		## Unexpected error
		Please check the console for more details.
		`;
		modal.render({
			markdown,
			onUpload: () => Promise.resolve(),
			showUpload: false,
		});
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
