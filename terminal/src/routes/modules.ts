import { FastifyInstance } from "fastify";
import { getDb } from "../db";
import { exec } from "child_process";
import * as net from "net";

const MODULE_IMAGE = process.env.MODULE_BASE_IMAGE ?? "terminal-example-module";
const DOCKER_NETWORK = process.env.DOCKER_NETWORK ?? "terminal_default";

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "0.0.0.0");
  });
}

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

function slugify(value: string, fallback: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length ? slug : fallback;
}

async function removeContainerIfExists(containerName: string, log: (line: string) => void) {
  try {
    await execPromise(`docker rm -f ${containerName} >/dev/null 2>&1 || true`);
    log(`Removed existing container ${containerName} (if present).`);
  } catch (err: any) {
    log(`Failed to clean up container ${containerName}: ${err?.stderr || err?.message || err}`);
  }
}

async function startModuleContainer(
  containerName: string,
  port: number,
  log: (line: string) => void,
) {
  try {
    log(`Starting container ${containerName} on port ${port}.`);
    await execPromise(
      `docker run -d --name ${containerName} --network ${DOCKER_NETWORK} -p ${port}:8000 ${MODULE_IMAGE}`,
    );
    log(`Container ${containerName} started.`);
  } catch (err: any) {
    log(`Failed to start container ${containerName}: ${err?.stderr || err?.message || err}`);
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function configureModuleInstance(
  serviceUrl: string,
  moduleId: string,
  name: string,
  port: number,
  log: (line: string) => void,
) {
  const targetUrl = new URL("/module/configuration", serviceUrl).toString();
  log(`Waiting for container to be ready...`);

  // Retry up to 10 times with 1 second delay (container may take a moment to start)
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      log(`Calling module configuration at ${targetUrl} (attempt ${attempt}).`);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: moduleId, name, port }),
      });
      if (!res.ok) {
        const text = await res.text();
        log(`Module configuration failed with status ${res.status}: ${text}`);
        throw new Error(`Module configuration request failed with status ${res.status}`);
      }
      log("Module configuration completed.");
      return;
    } catch (err: any) {
      lastError = err;
      log(`Attempt ${attempt} failed: ${err?.message || err}. Retrying in 1s...`);
      await sleep(1000);
    }
  }
  throw lastError || new Error("Failed to configure module after 10 attempts");
}

export function registerModuleRoutes(app: FastifyInstance) {
  app.get("/api/modules", async () => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM modules").all();
    return rows.map((row: any) => ({
      ...row,
      enabled: !!row.enabled,
    }));
  });

  app.post("/api/modules/initialize", async (request, reply) => {
    const db = getDb();
    const body = request.body as { githubUrl?: string; name?: string; port?: number };

    if (!body.githubUrl || typeof body.githubUrl !== "string") {
      reply.code(400);
      return { error: "githubUrl is required" };
    }
    if (typeof body.port !== "number" || !Number.isInteger(body.port) || body.port <= 0 || body.port > 65535) {
      reply.code(400);
      return { error: "Valid port (1-65535) is required" };
    }

    // Check if port is available before proceeding
    const portAvailable = await isPortAvailable(body.port);
    if (!portAvailable) {
      reply.code(400);
      return { error: `Port ${body.port} is already in use. Please choose a different port.` };
    }

    const baseId = `mod-${Date.now()}`;
    const slugBase = slugify(body.name || baseId, baseId);
    const uniqueSuffix = Date.now().toString(36);
    const containerName = `${slugBase}-${uniqueSuffix}`;
    const serviceUrl = `http://${containerName}:8000`;
    const now = new Date().toISOString();
    const logs: string[] = [];
    const addLog = (line: string) => {
      const entry = `[${new Date().toISOString()}] ${line}`;
      logs.push(entry);
      request.log.info({ moduleId: baseId }, line);
    };

    try {
      db.prepare(
        `INSERT INTO modules (id, name, description, type, service_url, github_url, container_name, port, enabled, created_at, updated_at)
         VALUES (@id, @name, NULL, NULL, @service_url, @github_url, @container_name, NULL, 0, @created_at, @updated_at)`,
      ).run({
        id: baseId,
        name: body.name && body.name.trim().length ? body.name.trim() : baseId,
        service_url: serviceUrl,
        github_url: body.githubUrl,
        container_name: containerName,
        created_at: now,
        updated_at: now,
      });
      addLog("Module record created in database.");

      await removeContainerIfExists(containerName, addLog);
      await startModuleContainer(containerName, body.port, addLog);
      await configureModuleInstance(serviceUrl, baseId, body.name || baseId, body.port, addLog);

      db.prepare(
        "UPDATE modules SET port = @port, enabled = 1, service_url = @service_url, container_name = @container_name, updated_at = @updated_at WHERE id = @id",
      ).run({
        id: baseId,
        port: body.port,
        service_url: serviceUrl,
        container_name: containerName,
        updated_at: new Date().toISOString(),
      });

      const moduleRow = db.prepare("SELECT * FROM modules WHERE id = ?").get(baseId);
      reply.code(201);
      return { ok: true, module: moduleRow, logs };
    } catch (err: any) {
      addLog(`Initialisation failed: ${err?.stderr || err?.message || err}`);
      reply.code(502);
      return { error: "Failed to initialise module", logs };
    }
  });

  app.post("/api/modules/:id/configuration", async (request, reply) => {
    const db = getDb();
    const params = request.params as { id: string };
    const body = request.body as { name: string; port: number };

    const row = db
      .prepare("SELECT container_name, service_url FROM modules WHERE id = ?")
      .get(params.id) as { container_name?: string; service_url?: string } | undefined;

    if (!row) {
      reply.code(404);
      return { error: "Module not found" };
    }

    // Check if port is available before proceeding
    const portAvailable = await isPortAvailable(body.port);
    if (!portAvailable) {
      reply.code(400);
      return { error: `Port ${body.port} is already in use. Please choose a different port.` };
    }

    const containerName = (row.container_name && row.container_name.trim().length > 0)
      ? row.container_name.trim()
      : params.id;
    const internalServiceUrl = row.service_url && row.service_url.trim().length > 0
      ? row.service_url
      : `http://${containerName}:8000`;
    const now = new Date().toISOString();
    const logs: string[] = [];
    const addLog = (line: string) => {
      const entry = `[${new Date().toISOString()}] ${line}`;
      logs.push(entry);
      request.log.info({ moduleId: params.id }, line);
    };

    try {
      await removeContainerIfExists(containerName, addLog);
      await startModuleContainer(containerName, body.port, addLog);

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

      await configureModuleInstance(internalServiceUrl, params.id, body.name, body.port, addLog);

      db.prepare(
        "UPDATE modules SET enabled = 1, updated_at = @updated_at WHERE id = @id",
      ).run({
        id: params.id,
        updated_at: new Date().toISOString(),
      });

      reply.code(200);
      return { ok: true, logs };
    } catch (err: any) {
      addLog(`Configuration failed: ${err?.stderr || err?.message || err}`);
      reply.code(502);
      return { error: "Failed to configure module", logs };
    }
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
