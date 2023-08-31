import { Setting } from "obsidian";
import { UploadPlan } from "./plan-upload";
import { FileStatus, ModalContext } from "src/shared/types";
import * as RT from "fp-ts/ReaderTask";
import * as RIO from "fp-ts/ReaderIO";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { renderMarkdown } from "src/shared/obsidian-fp";
import {
	emptyModalContent,
	openModal,
	renderModalDiv,
	renderModalHeader,
	renderModalSpan,
} from "src/shared/obsidian-fp/modal";
import { ConfirmPushChangesContext } from "../confirm-push-changes";

type PushChanges = (
	plan: UploadPlan
) => RT.ReaderTask<ConfirmPushChangesContext, void>;

export const openConfirmationModal =
	(pushChanges: PushChanges) => (uploadPlan: UploadPlan) => {
		return pipe(
			emptyModalContent(),
			RIO.map(() => isWarningModal(uploadPlan)),
			RIO.tap((isWarning) =>
				renderModalHeader(
					!isWarning ? "Upload confirmation" : "No changes to push..."
				)
			),
			RIO.tap((isWarning) =>
				renderModalSpan(
					!isWarning
						? `${uploadPlan.totalCount} file(s) have been checked for changes`
						: `No changes have been detected from ${uploadPlan.totalCount} file(s). This may be because of the following reason(s)`
				)
			),
			RIO.tap(() => renderContent(uploadPlan)),
			RIO.bindTo("isWarning"),
			RIO.bindW("context", () => RIO.ask<ConfirmPushChangesContext>()),
			RIO.tap(({ context, isWarning }) =>
				renderFooterbuttons(pushChanges(uploadPlan)(context), isWarning)
			),
			RIO.tap(openModal)
		);
	};

const renderContent = (uploadPlan: UploadPlan) => {
	return pipe(
		RIO.Do,
		RIO.apSW("element", renderModalDiv()),
		RIO.apSW("context", RIO.ask<ConfirmPushChangesContext>()),
		RIO.chainIOK(({ element, context }) =>
			pipe(
				[
					buildInfoProps,
					buildDeleteProps,
					buildWarningProps,
					buildErrorProps,
				],
				A.map(renderCallout),
				RIO.sequenceArray
			)({ uploadPlan, ...context, element })
		)
	);
};

const buildInfoProps = (plan: UploadPlan) => ({
	type: "success" as const,
	title: `Following ${plan.pending.length} file(s) will be uploaded to your blog`,
	lines: [],
	items: plan.pending.map((x) => x.file.path),
	show: plan.pending.length > 0,
});
const buildWarningProps = (plan: UploadPlan) => {
	return {
		type: "warning" as const,
		title: `Following ${plan.slugCollision.length} file(s) have colliding slugs and are skipped`,
		lines: [
			"You may need to set slugs manually in the frontmatter to resolve the conflicts.",
		],
		items: plan.slugCollision.map((x) => x.file.path),
		show: plan.slugCollision.length > 0,
	};
};
const buildDeleteProps = (plan: UploadPlan) => ({
	type: "info" as const,
	title: `Following ${plan.toDelete.length} file(s) will be deleted from your blog`,
	lines: [
		"These files will be deleted from the server. This plugin will never modify your local files.",
	],
	items: plan.toDelete,
	show: plan.toDelete.length > 0,
});
const buildErrorProps = (plan: UploadPlan) => ({
	type: "error" as const,
	title: `There were ${plan.errors.length} errors out while processing`,
	lines: [
		"This shouldn't normally happen. Please make sure the files are readable and try again.",
	],
	items: plan.errors.map((x) => x.message),
	show: plan.errors.length > 0,
});

const isWarningModal = (plan: UploadPlan) =>
	plan.pending.length === 0 && plan.toDelete.length === 0;

type UploadPlanContext = {
	uploadPlan: UploadPlan;
};
const renderCallout = (
	calloutBuilder: (plan: UploadPlan) => CalloutBlockProps
) =>
	pipe(
		RIO.asks((ctx: UploadPlanContext) => ctx.uploadPlan),
		RIO.map(calloutBuilder),
		RIO.map(renderCalloutBlockMarkdown),
		RIO.flatMap(renderMarkdown)
	);

const renderFooterbuttons =
	(onUpload: () => Promise<void>, isWarning: boolean) =>
	({ modal }: ModalContext) =>
	() => {
		if (isWarning) {
			return;
		}

		new Setting(modal.contentEl)
			.addButton((btn) => {
				btn.setButtonText("Cancel").onClick(() => {
					modal.close();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Upload")
					.onClick(async () => {
						try {
							await onUpload();
						} catch (e) {
							console.error(e);
						} finally {
							modal.close();
						}
					})
					.setCta();
			});
	};

type CalloutBlockProps = {
	title: string;
	type: "warning" | "info" | "success" | "error";
	items: string[];
	displayLimit?: number;
	lines: string[];
	show?: boolean;
};

const renderCalloutBlockMarkdown = ({
	title,
	type,
	lines,
	items,
	displayLimit,
	show = true,
}: CalloutBlockProps) => {
	if (!show) {
		return "";
	}
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
