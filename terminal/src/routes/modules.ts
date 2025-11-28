import { FastifyInstance } from "fastify";
import { getDb } from "../db";

export function registerModuleRoutes(app: FastifyInstance) {
  app.get("/api/modules", async () => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM modules").all();
    return rows.map((row: any) => ({
      ...row,
      enabled: !!row.enabled,
    }));
  });

  app.post("/api/modules", async (request, reply) => {
    const db = getDb();
    const body = request.body as {
      id: string;
      name: string;
      description?: string;
      serviceUrl: string;
      githubUrl?: string;
      enabled?: boolean;
    };

    const now = new Date().toISOString();
    const enabled = body.enabled ?? true;

    const stmt = db.prepare(`
      INSERT INTO modules (id, name, description, service_url, github_url, enabled, created_at, updated_at)
      VALUES (@id, @name, @description, @service_url, @github_url, @enabled, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        service_url = excluded.service_url,
        github_url = excluded.github_url,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at;
    `);

    stmt.run({
      id: body.id,
      name: body.name,
      description: body.description ?? null,
      service_url: body.serviceUrl,
      github_url: body.githubUrl ?? null,
      enabled: enabled ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    reply.code(201);
    return { ok: true };
  });
}
