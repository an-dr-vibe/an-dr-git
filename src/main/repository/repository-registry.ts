import { randomUUID } from "node:crypto";

import type { RepositoryIdentity } from "../../shared/contracts/app-shell.js";
import { RepositorySession } from "./repository-session.js";

type RepositorySessionSeed = Omit<RepositoryIdentity, "sessionId">;

export class RepositoryRegistry {
  readonly #sessionsByRootPath = new Map<string, RepositorySession>();
  readonly #sessionsById = new Map<string, RepositorySession>();
  #activeSessionId: string | null = null;

  activate(seed: RepositorySessionSeed): RepositoryIdentity {
    const existingSession = this.#sessionsByRootPath.get(seed.rootPath);
    const identity: RepositoryIdentity = {
      sessionId: existingSession?.getIdentity().sessionId ?? randomUUID(),
      ...seed,
    };

    const session = existingSession ?? new RepositorySession(identity);

    session.updateIdentity(identity);
    this.#sessionsByRootPath.set(identity.rootPath, session);
    this.#sessionsById.set(identity.sessionId, session);
    this.#activeSessionId = identity.sessionId;

    return session.getIdentity();
  }

  getActive(): RepositoryIdentity | null {
    const session = this.#activeSessionId ? this.#sessionsById.get(this.#activeSessionId) : null;

    if (!session) {
      return null;
    }

    return session.getIdentity();
  }

  list(): RepositoryIdentity[] {
    return [...this.#sessionsByRootPath.values()].map((session) => session.getIdentity());
  }

  getBySessionId(sessionId: string): RepositorySession | null {
    return this.#sessionsById.get(sessionId) ?? null;
  }

  activateSession(sessionId: string): RepositoryIdentity | null {
    const session = this.#sessionsById.get(sessionId);

    if (!session) {
      return null;
    }

    this.#activeSessionId = sessionId;
    return session.getIdentity();
  }

  close(sessionId: string): RepositoryIdentity | null {
    const session = this.#sessionsById.get(sessionId);

    if (!session) {
      return null;
    }

    const identity = session.close();

    this.#sessionsById.delete(sessionId);
    this.#sessionsByRootPath.delete(identity.rootPath);

    if (this.#activeSessionId === sessionId) {
      const nextSession = this.#sessionsByRootPath.values().next().value ?? null;
      this.#activeSessionId = nextSession ? nextSession.getIdentity().sessionId : null;
    }

    return identity;
  }
}
