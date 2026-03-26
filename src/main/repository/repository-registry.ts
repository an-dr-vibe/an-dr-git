import { randomUUID } from "node:crypto";

import type { RepositoryIdentity } from "../../shared/contracts/app-shell.js";

type RepositorySessionSeed = Omit<RepositoryIdentity, "sessionId">;

export class RepositoryRegistry {
  readonly #sessionsByRootPath = new Map<string, RepositoryIdentity>();
  #activeSessionId: string | null = null;

  activate(seed: RepositorySessionSeed): RepositoryIdentity {
    const existingSession = this.#sessionsByRootPath.get(seed.rootPath);
    const session: RepositoryIdentity = {
      sessionId: existingSession?.sessionId ?? randomUUID(),
      ...seed,
    };

    this.#sessionsByRootPath.set(seed.rootPath, session);
    this.#activeSessionId = session.sessionId;

    return session;
  }

  getActive(): RepositoryIdentity | null {
    if (!this.#activeSessionId) {
      return null;
    }

    for (const session of this.#sessionsByRootPath.values()) {
      if (session.sessionId === this.#activeSessionId) {
        return session;
      }
    }

    return null;
  }
}
