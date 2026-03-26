import { z } from "zod";

import { appShellErrorSchema, repositoryIdentitySchema } from "./app-shell.js";

export const repositoryDiffRequestSchema = z.object({
  sessionId: z.string().min(1),
  filePath: z.string().min(1),
});
export type RepositoryDiffRequest = z.infer<typeof repositoryDiffRequestSchema>;

export const diffParseStateSchema = z.enum(["empty", "parsed", "partial", "raw", "binary"]);
export type DiffParseState = z.infer<typeof diffParseStateSchema>;

export const diffFileChangeTypeSchema = z.enum([
  "modified",
  "added",
  "deleted",
  "renamed",
  "copied",
  "mode-changed",
  "unknown",
]);
export type DiffFileChangeType = z.infer<typeof diffFileChangeTypeSchema>;

export const diffMarkerSchema = z.enum([
  "binary",
  "rename",
  "copy",
  "mode-change",
  "new-file",
  "deleted-file",
  "no-newline",
]);
export type DiffMarker = z.infer<typeof diffMarkerSchema>;

export const diffLineKindSchema = z.enum(["context", "addition", "deletion", "meta"]);
export type DiffLineKind = z.infer<typeof diffLineKindSchema>;

export const diffLineSchema = z.object({
  kind: diffLineKindSchema,
  text: z.string(),
  oldLineNumber: z.number().int().positive().nullable(),
  newLineNumber: z.number().int().positive().nullable(),
});
export type DiffLine = z.infer<typeof diffLineSchema>;

export const diffHunkSchema = z.object({
  header: z.string().min(1),
  oldStart: z.number().int().nonnegative(),
  oldLines: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  newLines: z.number().int().nonnegative(),
  lines: z.array(diffLineSchema),
});
export type DiffHunk = z.infer<typeof diffHunkSchema>;

export const diffFileSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
  displayPath: z.string().min(1),
  changeType: diffFileChangeTypeSchema,
  markers: z.array(diffMarkerSchema),
  headerLines: z.array(z.string()),
  hunks: z.array(diffHunkSchema),
});
export type DiffFile = z.infer<typeof diffFileSchema>;

export const repositoryDiffDocumentSchema = z.object({
  requestedPath: z.string().min(1),
  parseState: diffParseStateSchema,
  rawText: z.string(),
  files: z.array(diffFileSchema),
  warnings: z.array(z.string().min(1)),
});
export type RepositoryDiffDocument = z.infer<typeof repositoryDiffDocumentSchema>;

export const repositoryDiffResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("loaded"),
    activeRepository: repositoryIdentitySchema,
    request: repositoryDiffRequestSchema,
    document: repositoryDiffDocumentSchema,
  }),
  z.object({
    kind: z.literal("error"),
    activeRepository: repositoryIdentitySchema.nullable(),
    request: repositoryDiffRequestSchema.optional(),
    error: appShellErrorSchema,
  }),
]);
export type RepositoryDiffResult = z.infer<typeof repositoryDiffResultSchema>;
