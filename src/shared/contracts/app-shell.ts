import { z, type ZodError, type ZodType } from "zod";

export const APP_SHELL_CHANNELS = {
  getBootstrap: "app-shell:get-bootstrap",
  getGitStatus: "app-shell:get-git-status",
  openRepository: "app-shell:open-repository",
  pickAndOpenRepository: "app-shell:pick-and-open-repository",
} as const;

export const appShellPlatformSchema = z.enum(["darwin", "linux", "win32"]);
export type AppShellPlatform = z.infer<typeof appShellPlatformSchema>;

export const appShellPanelIdSchema = z.enum(["repository-tree", "branch-state", "diff-inspector"]);
export type AppShellPanelId = z.infer<typeof appShellPanelIdSchema>;

export const appShellBootstrapSchema = z.object({
  appName: z.string().min(1),
  shellVersion: z.string().min(1),
  platform: appShellPlatformSchema,
  isPackaged: z.boolean(),
  sessionContainerLabel: z.string().min(1),
});
export type AppShellBootstrap = z.infer<typeof appShellBootstrapSchema>;

export const appShellPanelDefinitionSchema = z.object({
  id: appShellPanelIdSchema,
  title: z.string().min(1),
  eyebrow: z.string().min(1),
  description: z.string().min(1),
});
export type AppShellPanelDefinition = z.infer<typeof appShellPanelDefinitionSchema>;

export const appShellErrorCodeSchema = z.enum([
  "INVALID_PAYLOAD",
  "GIT_MISSING",
  "GIT_UNUSABLE",
  "PATH_NOT_FOUND",
  "PATH_NOT_DIRECTORY",
  "PATH_NOT_ACCESSIBLE",
  "NOT_A_REPOSITORY",
  "UNSUPPORTED_REPOSITORY",
  "UNEXPECTED",
]);

export const appShellErrorSchema = z.object({
  code: appShellErrorCodeSchema,
  summary: z.string().min(1),
  detail: z.string().min(1),
  stderr: z.string().min(1).optional(),
  repositoryPath: z.string().min(1).optional(),
});
export type AppShellError = z.infer<typeof appShellErrorSchema>;

export const gitStatusSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready"),
    executablePath: z.string().min(1),
    version: z.string().min(1),
  }),
  z.object({
    kind: z.literal("missing"),
    error: appShellErrorSchema,
  }),
  z.object({
    kind: z.literal("unusable"),
    error: appShellErrorSchema,
    executablePath: z.string().min(1).optional(),
  }),
]);
export type GitStatus = z.infer<typeof gitStatusSchema>;

export const openRepositoryRequestSchema = z.object({
  repositoryPath: z.string().trim().min(1),
});
export type OpenRepositoryRequest = z.infer<typeof openRepositoryRequestSchema>;

export const repositoryIdentitySchema = z.object({
  sessionId: z.string().min(1),
  rootPath: z.string().min(1),
  gitDirectoryPath: z.string().min(1),
  currentHead: z.string().min(1),
  isDetached: z.boolean(),
  isUnborn: z.boolean(),
});
export type RepositoryIdentity = z.infer<typeof repositoryIdentitySchema>;

export const openRepositoryResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("opened"),
    repository: repositoryIdentitySchema,
  }),
  z.object({
    kind: z.literal("cancelled"),
  }),
  z.object({
    kind: z.literal("error"),
    error: appShellErrorSchema,
  }),
]);
export type OpenRepositoryResult = z.infer<typeof openRepositoryResultSchema>;

export interface AppShellApi {
  getBootstrap(): Promise<AppShellBootstrap>;
  getGitStatus(): Promise<GitStatus>;
  openRepository(request: OpenRepositoryRequest): Promise<OpenRepositoryResult>;
  pickAndOpenRepository(): Promise<OpenRepositoryResult>;
}

export function formatValidationError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "value";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function validateContract<T>(schema: ZodType<T>, value: unknown, contractName: string): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new Error(`Invalid ${contractName}. ${formatValidationError(parsed.error)}`);
  }

  return parsed.data;
}

export function createInvalidPayloadError(contractName: string, error: ZodError): AppShellError {
  return {
    code: "INVALID_PAYLOAD",
    summary: "The request payload was invalid.",
    detail: `${contractName} rejected the provided payload. ${formatValidationError(error)}`,
  };
}
