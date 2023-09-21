import { A, NEA, O, pipe, r } from "src/shared/fp";
import { Manifest } from "../shared/manifest";
import { FType, PFileWithMd5 } from "../shared/types";
import {
	SlugCollisionError,
	NetworkError,
	FileProcessingError,
	Md5CollisionError,
} from "src/shared/errors";

type Args = {
	left: Error[];
	right: PFileWithMd5[];
	manifest: Manifest;
};

enum FailureType {
	SlugCollision = "SLUG_COLLISION",
	Md5Collision = "MD5_COLLISION",
	FileProcessingError = "FILE_PROCESSING_ERROR",
	OtherError = "OTHER_ERROR",
	NetworkError = "NETWORK_ERROR",
}

type SortedFailures = {
	type: FailureType;
	errors: Error[];
};

type CalloutBlockProps = {
	title: string;
	type: "warning" | "info" | "success" | "error";
	lines: string[];
	items: string[];
	displayLimit?: number;
};

export const buildCalloutMarkdown = ({ left, right, manifest }: Args) => {
	const success = pipe(filesToUploadProps(right));

	const info = filesToDeleteVm(manifest);

	const warnings = pipe(left, sortErrors, A.map(sortedFailureToCalloutBlock));

	return pipe(
		[success, info, ...warnings],
		A.compact,
		A.map(renderCalloutBlockMarkdown),
		A.prepend(buildHeading({ right, left, manifest })),
		A.append(buildWarning({ right, left, manifest })),
		(msgs) => msgs.join("\n\n")
	);
};

const buildHeading = ({ right, left }: Args) => {
	const fileCount = right.length + left.length;
	if (!right.length) {
		return `## No changes to upload\n\n ${fileCount} file(s) have been checked for changes`;
	}
	return `## Changes to upload\n\n ${fileCount} file(s) have been checked for changes`;
};

const buildWarning = ({ right, manifest }: Args) => {
	if (
		!right.length &&
		!manifest.getItemsToDelete.posts.length &&
		!manifest.getItemsToDelete.assets.length
	) {
		return "";
	}
	return "These changes are for your blog only. This plugin will _never_ modify your local obsidian files.";
};

const filesToUploadProps = (
	files: PFileWithMd5[]
): O.Option<CalloutBlockProps> => {
	if (!files.length) {
		return O.none;
	}

	const { left, right } = pipe(
		files,
		A.partition((x) => x.type === FType.Post)
	);

	return O.some({
		type: "success" as const,
		title: `${right.length} post(s) and ${left.length} asset(s) will be uploaded to your blog`,
		lines: [],
		items: files.map((x) => x.file.path),
	});
};

const filesToDeleteVm = (manifest: Manifest): O.Option<CalloutBlockProps> => {
	const { posts, assets } = manifest.getItemsToDelete;
	if (!posts.length && !assets.length) {
		return O.none;
	}
	const items = pipe(
		posts,
		A.map((x) => "/" + x.slug)
	);

	const lines = assets.length
		? [
				`${assets.length} asset(s) that are no longer referenced will be deleted as well`,
		  ]
		: [];

	return O.some({
		type: "warning" as const,
		title: `Following ${posts.length} post(s) will be deleted from your blog`,
		lines,
		items,
	});
};

// sort errors
const errorToFailureType = (error: Error) => {
	if (error instanceof SlugCollisionError) {
		return FailureType.SlugCollision;
	}
	if (error instanceof Md5CollisionError) {
		return FailureType.Md5Collision;
	}
	if (error instanceof FileProcessingError) {
		return FailureType.FileProcessingError;
	}
	if (error instanceof NetworkError) {
		return FailureType.NetworkError;
	}
	return FailureType.OtherError;
};

const buildSortedFailure = (
	type: FailureType,
	errors: Error[] = []
): SortedFailures => ({
	type,
	errors,
});

const sortErrors = (errors: Error[]): SortedFailures[] => {
	return pipe(
		errors,
		NEA.groupBy(errorToFailureType),
		r.toEntries,
		A.map(([type, errors]) => {
			return buildSortedFailure(type as FailureType, Array.from(errors));
		}),
		A.filter((s) => s.errors.length > 0)
	);
};

// build error callout block
const slugCollisionsProps = (errors: SlugCollisionError[]) => {
	return {
		type: "warning" as const,
		title: `Following ${errors.length} file(s) have colliding slugs and have been skipped`,
		lines: [
			"You can manually set slugs in the frontmatter to resolve the conflicts.",
		],
		items: errors.map(
			(x) => `${x.file.path} (collising with ${x.message})`
		),
	};
};

const fileProcessingErrorProps = (errors: Error[]) => ({
	type: "error" as const,
	title: `There were ${errors.length} errors out while processing`,
	lines: [
		"This shouldn't normally happen. Please make sure the files are readable and try again.",
	],
	items: errors.map((x) => x.message),
});

const otherErrorProps = (errors: Error[]) => ({
	type: "error" as const,
	title: `There were unhandled ${errors.length} errors out while processing`,
	lines: [
		"This shouldn't normally happen. Please make sure the files are readable and try again.",
	],
	items: errors.map((x) => x.message),
});

const sortedFailureToCalloutBlock = (
	f: SortedFailures
): O.Option<CalloutBlockProps> => {
	let props: CalloutBlockProps | null = null;
	switch (f.type) {
		case FailureType.SlugCollision:
			props = slugCollisionsProps(f.errors as SlugCollisionError[]);
			break;
		case FailureType.FileProcessingError:
			props = fileProcessingErrorProps(f.errors);
			break;
		case FailureType.OtherError:
			props = otherErrorProps(f.errors);
			break;
		default:
			break;
	}

	return O.fromNullable(props);
};

const renderCalloutBlockMarkdown = ({
	title,
	type,
	lines,
	items,
	displayLimit,
}: CalloutBlockProps) => {
	return pipe(
		items,
		A.takeLeft(displayLimit ?? 5),
		A.map((line) => `> - ${line}`),
		(msgs) =>
			msgs.length < items.length
				? [...msgs, `> - and ${items.length - msgs.length} more`]
				: msgs,
		(msgs) => [
			`> [!${type}] ${title}`,
			...msgs,
			">",
			...lines.map((x) => `> ${x}`),
		],
		(msgs) => msgs.join("\n")
	);
};
