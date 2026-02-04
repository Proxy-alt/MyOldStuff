/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      username: string;
      is_admin: number;
      avatar_url?: string;
      bio?: string;
      created_at: number;
      updated_at: number;
    };
  }
}
