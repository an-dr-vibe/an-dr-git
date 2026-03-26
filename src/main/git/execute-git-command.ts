import { logGitCommandResult, type GitCommandContext } from "./git-command-logger.js";
import { runCommand, type CommandExecutionResult, type RunCommandOptions } from "./run-command.js";

export async function executeGitCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions & GitCommandContext
): Promise<CommandExecutionResult> {
  const result = await runCommand(command, args, options);
  logGitCommandResult(result, options);
  return result;
}
