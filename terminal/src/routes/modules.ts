import { FastifyInstance } from "fastify";
import { getDb } from "../db";
import { exec } from "child_process";

export function registerModuleRoutes(app: FastifyInstance) {
  app.get("/api/modules", async () => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM modules").all();
    return rows.map((row: any) => ({
      ...row,
      enabled: !!row.enabled,
    }));
  });

  app.post("/api/modules/:id/configuration", async (request, reply) => {
    const db = getDb();
    const params = request.params as { id: string };
    const body = request.body as { name: string; port: number };

    const row = db
      .prepare("SELECT container_name FROM modules WHERE id = ?")
      .get(params.id) as { container_name?: string } | undefined;

    if (!row) {
      reply.code(404);
      return { error: "Module not found" };
    }

    const containerName = (row.container_name && row.container_name.trim().length > 0)
      ? row.container_name.trim()
      : params.id;
    const internalServiceUrl = `http://${containerName}:8000`;
    const now = new Date().toISOString();

    function execPromise(cmd: string): Promise<{ stdout: string; stderr: string }> {
      return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            reject(Object.assign(error, { stdout, stderr }));
            return;
          }
          resolve({ stdout, stderr });
        });
      });
    }

    // Stop any existing container with this name (ignore errors).
    try {
      await execPromise(`docker rm -f ${containerName} 2>/dev/null || true`);
    } catch (err) {
      request.log.warn({ err }, "Failed to remove existing module container (continuing)");
    }

    // Start a fresh container for this instance.
    // NOTE: this assumes the image has already been built, e.g. by docker compose,
    // and is available locally under the name "terminal-example-module".
    try {
      await execPromise(
        `docker run -d --name ${containerName} -p ${body.port}:8000 terminal-example-module`,
      );
    } catch (err) {
      request.log.error({ err }, "Failed to start module container");
      reply.code(502);
      return { error: "Failed to start module container" };
    }

    // Update DB with latest configuration. enabled will be flipped to 1 after
    // the module successfully applies its configuration.
    db.prepare(
      "UPDATE modules SET name = @name, port = @port, service_url = @service_url, container_name = @container_name, updated_at = @updated_at WHERE id = @id",
    ).run({
      id: params.id,
      name: body.name,
      port: body.port,
      service_url: internalServiceUrl,
      container_name: containerName,
      updated_at: now,
    });

    const targetUrl = new URL("/module/configuration", internalServiceUrl).toString();

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: params.id, name: body.name, port: body.port }),
      });
      if (!res.ok) {
        request.log.error({ status: res.status }, "Module configuration endpoint returned non-2xx");
        reply.code(502);
        return { error: "Module configuration request failed", status: res.status };
      }
    } catch (err) {
      request.log.error({ err }, "Failed to call module configuration endpoint");
      reply.code(502);
      return { error: "Failed to reach module for configuration" };
    }

    // Only mark enabled once container is up and configuration succeeded.
    db.prepare(
      "UPDATE modules SET enabled = 1, updated_at = @updated_at WHERE id = @id",
    ).run({
      id: params.id,
      updated_at: new Date().toISOString(),
    });

    reply.code(200);
    return { ok: true };
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
      containerName?: string;
    };

    const now = new Date().toISOString();
    const enabled = body.enabled ?? true;
    const containerName = body.containerName && body.containerName.trim().length > 0
      ? body.containerName.trim()
      : body.id;

    const stmt = db.prepare(`
      INSERT INTO modules (id, name, description, type, service_url, github_url, container_name, port, enabled, created_at, updated_at)
      VALUES (@id, @name, @description, @type, @service_url, @github_url, @container_name, @port, @enabled, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        type = excluded.type,
        service_url = excluded.service_url,
        github_url = excluded.github_url,
        container_name = excluded.container_name,
        port = excluded.port,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at;
    `);

    stmt.run({
      id: body.id,
      name: body.name,
      description: body.description ?? null,
      type: null,
      service_url: body.serviceUrl,
      github_url: body.githubUrl ?? null,
      container_name: containerName,
      port: null,
      enabled: enabled ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    reply.code(201);
    return { ok: true };
  });

  app.get("/api/modules/:id/metadata", async (request, reply) => {
    const db = getDb();
    const params = request.params as { id: string };
    const row = db
      .prepare("SELECT service_url FROM modules WHERE id = ?")
      .get(params.id) as { service_url: string } | undefined;

    if (!row) {
      reply.code(404);
      return { error: "Module not found" };
    }

    const targetUrl = new URL("/module/metadata", row.service_url).toString();

    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        reply.code(502);
        return { error: "Module metadata request failed", status: res.status };
      }
      const data = await res.json();
      return data;
    } catch (err) {
      request.log.error({ err }, "Failed to fetch module metadata");
      reply.code(502);
      return { error: "Failed to reach module" };
    }
  });

  app.delete("/api/modules/:id", async (request, reply) => {
    const db = getDb();
    const params = request.params as { id: string };

    const row = db
      .prepare("SELECT id, container_name FROM modules WHERE id = ?")
      .get(params.id) as { id: string; container_name?: string | null } | undefined;

    if (!row) {
      reply.code(404);
      return { error: "Module not found" };
    }

    // Best-effort: stop and remove Docker container using stored container_name, or fall back to id
    const containerName = (row && row.container_name) ? row.container_name : params.id;

    await new Promise<void>((resolve) => {
      exec(
        `docker stop ${containerName} || true && docker rm ${containerName} || true`,
        (error) => {
          if (error) {
            app.log.warn({ err: error }, "Failed to stop/remove container; continuing to delete from DB");
          }
          resolve();
        },
      );
    });

    db.prepare("DELETE FROM modules WHERE id = ?").run(params.id);

    reply.code(200);
    return { ok: true };
  });
}
