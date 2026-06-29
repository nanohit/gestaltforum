import type { PublicUser } from '$lib/server/auth';

declare global {
  namespace App {
    interface Locals {
      user: PublicUser | null;
      sessionId: string | null;
    }

    interface PageData {
      user: PublicUser | null;
    }
  }
}

export {};
