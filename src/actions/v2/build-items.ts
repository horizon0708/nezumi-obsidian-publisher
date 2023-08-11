import { pipe } from "fp-ts/lib/function";
import { TFile } from "obsidian";
import { buildBaseItem } from "./build-base-item";
import * as SRTE from "fp-ts/StateReaderTaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RT from "fp-ts/ReaderTask";
import * as O from "fp-ts/Option";
import * as A from "fp-ts/Array";
import {
	ManifestState,
	emptyState,
	markLocalCopySRTE,
	registerEmbeddedAssetsSRTE,
} from "./manifest-state";
import { Asset, BaseContext, BaseItem, Item, Post } from "../types";
import { FileError } from "./file-error";
import { buildPostOrAsset } from "./build-post";
import { checkMd5Collision } from "./check-md5-collision";
import { SRTEMonoid, leftFold, rightFold } from "./srte-monoid";
import { concatAll } from "fp-ts/lib/Monoid";

const buildItem = (state: ManifestState) => (file: TFile) =>
	pipe(
		SRTE.fromReaderTaskEither<
			BaseContext,
			FileError,
			BaseItem,
			ManifestState
		>(buildBaseItem(file)),
		SRTE.tap((item) => registerEmbeddedAssetsSRTE(item.embeddedAssets)),
		SRTE.tap((item) => markLocalCopySRTE(item.serverPath)),
		SRTE.chainW((item) => buildPostOrAsset(item)),
		SRTE.chainW((item) => checkMd5Collision(item)),
		SRTE.chainW((item) =>
			pipe(
				SRTE.gets((s: ManifestState) =>
					rightFold<FileError, Item, ManifestState>(item, s)
				)
			)
		),
		SRTE.evaluate(state),
		RTE.orElse((e) => RTE.of(leftFold(e)))
	);

export const buildItems = (state: ManifestState) => (files: TFile[]) =>
	pipe(
		files,
		A.map(buildItem(state)),
		// This needs to be SeqArray
		// as we need to check for duplicates / collisions
		// could really just check in the end for collisions
		// and make the code way simpler...(:thinking:)
		RTE.sequenceSeqArray,
		RTE.map((e) =>
			pipe(
				SRTEMonoid<FileError, Item, ManifestState>(emptyState()),
				concatAll
			)(e)
		),
		RTE.chainW((args) =>
			pipe(
				args.state,
				// if State is None ... something is very wrong!
				RTE.fromOption(() => new Error("state is none")),
				RTE.map((someState) => ({ ...args, state: someState }))
			)
		)
	);
