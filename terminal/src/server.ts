import Fastify from "fastify";
import cors from "@fastify/cors";
import { initDb } from "./db";
import { registerModuleRoutes } from "./routes/modules";

export async function createServer() {
  const app = Fastify({ logger: true });

  await initDb();

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/", async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Terminal Modules</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; background: #0f172a; color: #e5e7eb; }
      h1 { margin-bottom: 0.5rem; }
      p { color: #9ca3af; }
      .layout { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; align-items: flex-start; }
      @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
      th, td { border-bottom: 1px solid #1f2937; padding: 0.5rem 0.4rem; text-align: left; }
      th { color: #9ca3af; font-weight: 500; }
      tr:hover td { background: #020617; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.85em; }
      .badge { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 9999px; font-size: 0.75rem; }
      .badge-on { background: #22c55e22; color: #4ade80; border: 1px solid #22c55e55; }
      .badge-off { background: #ef444422; color: #fca5a5; border: 1px solid #ef444466; }
      .card { background: #020617; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 1rem 1.2rem; box-shadow: 0 10px 40px rgba(15,23,42,0.8); }
      label { display: block; margin-bottom: 0.25rem; font-size: 0.8rem; color: #9ca3af; }
      input, textarea { width: 100%; padding: 0.5rem 0.6rem; border-radius: 0.5rem; border: 1px solid #1f2937; background: #020617; color: #e5e7eb; font-size: 0.9rem; }
      input:focus, textarea:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 1px #38bdf8; }
      textarea { resize: vertical; min-height: 3.2rem; }
      .field { margin-bottom: 0.75rem; }
      .actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center; }
      button { cursor: pointer; padding: 0.45rem 0.9rem; border-radius: 9999px; border: none; font-size: 0.85rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.3rem; }
      button.primary { background: linear-gradient(to right, #22c55e, #16a34a); color: #022c22; }
      button.secondary { background: #020617; color: #e5e7eb; border: 1px solid #1f2937; }
      .status { font-size: 0.8rem; color: #9ca3af; min-height: 1.1rem; }
      a.link { color: #38bdf8; text-decoration: none; }
      a.link:hover { text-decoration: underline; }
      .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.8); display: none; align-items: center; justify-content: center; z-index: 50; }
      .modal { background: #020617; border-radius: 0.75rem; border: 1px solid #1f2937; padding: 1rem 1.25rem; max-width: 26rem; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.75); }
      .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
      .pill { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; border: 1px solid #1f2937; color: #9ca3af; }
      .pill-dot { width: 0.45rem; height: 0.45rem; border-radius: 9999px; background: #4ade80; }
      .modal-body dt { font-size: 0.75rem; color: #9ca3af; margin-top: 0.6rem; }
      .modal-body dd { margin: 0.1rem 0 0; font-size: 0.88rem; word-break: break-all; }
      .modal-actions { margin-top: 0.9rem; display: flex; justify-content: flex-end; }
    </style>
  </head>
  <body>
    <h1>Terminal: Modules</h1>
    <p>Lightweight registry of module containers. Data is stored locally in SQLite inside the <code>terminal</code> service.</p>
    <div class="layout">
      <section class="card">
        <h2 style="margin-top:0">Configured modules</h2>
        <div id="modules-status" class="status"></div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Service URL</th>
              <th>GitHub</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="modules-body">
            <tr><td colspan="5" style="padding:0.8rem 0.4rem;color:#6b7280">Loading modules…</td></tr>
          </tbody>
        </table>
      </section>
      <section class="card">
        <h2 style="margin-top:0">Add / update module</h2>
        <form id="module-form">
          <div class="field">
            <label for="id">ID</label>
            <input id="id" name="id" placeholder="example-module" required />
          </div>
          <div class="field">
            <label for="name">Name</label>
            <input id="name" name="name" placeholder="Example Module" required />
          </div>
          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" name="description" placeholder="Short description of what this module does"></textarea>
          </div>
          <div class="field">
            <label for="serviceUrl">Service URL (inside Docker network)</label>
            <input id="serviceUrl" name="serviceUrl" placeholder="http://example-module:8000" required />
          </div>
          <div class="field">
            <label for="githubUrl">GitHub URL</label>
            <input id="githubUrl" name="githubUrl" placeholder="https://github.com/you/example-module" />
          </div>
          <div class="field">
            <label>
              <input id="enabled" name="enabled" type="checkbox" checked style="width:auto;margin-right:0.4rem" />
              Enabled
            </label>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Save module</button>
            <button type="button" id="load-example" class="secondary">Load example defaults</button>
          </div>
          <div id="form-status" class="status"></div>
        </form>
      </section>
    </div>
    <div id="details-modal-backdrop" class="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <div>
            <div id="details-id" style="font-size:0.8rem;color:#9ca3af"></div>
            <div id="details-name" style="font-size:1rem;font-weight:600;color:#e5e7eb"></div>
          </div>
          <button type="button" id="details-close" class="secondary">Close</button>
        </div>
        <div class="modal-body">
          <dl>
            <dt>Description</dt>
            <dd id="details-description"></dd>
            <dt>Service URL</dt>
            <dd><code id="details-service-url"></code></dd>
            <dt>GitHub</dt>
            <dd id="details-github"></dd>
            <dt>Status</dt>
            <dd><span id="details-status" class="badge"></span></dd>
            <dt>Created / Updated</dt>
            <dd id="details-timestamps"></dd>
          </dl>
        </div>
        <div class="modal-actions">
          <span class="pill"><span class="pill-dot"></span>Module details</span>
        </div>
      </div>
    </div>
    <script>
      let currentModules = [];

      async function fetchModules() {
        const statusEl = document.getElementById('modules-status');
        const bodyEl = document.getElementById('modules-body');
        statusEl.textContent = 'Refreshing…';
        try {
          const res = await fetch('/api/modules');
          if (!res.ok) throw new Error('Request failed with ' + res.status);
          const modules = await res.json();
          currentModules = modules;
          statusEl.textContent = modules.length ? '' : 'No modules configured yet.';
          if (!modules.length) {
            bodyEl.innerHTML = '<tr><td colspan="5" style="padding:0.8rem 0.4rem;color:#6b7280">No modules yet. Use the form on the right to add one.</td></tr>';
            return;
          }
          bodyEl.innerHTML = modules.map(function (m) {
            var github = m.github_url || m.githubUrl;
            var enabled = m.enabled === true || m.enabled === 1;
            var safe = function (v) { return v == null ? '' : String(v); };
            var githubCell = github
              ? '<a class="link" href="' + github + '" target="_blank" rel="noopener noreferrer">GitHub</a>'
              : '<span style="color:#6b7280">—</span>';
            var statusClass = enabled ? 'badge-on' : 'badge-off';
            var statusLabel = enabled ? 'Enabled' : 'Disabled';
            return '<tr data-id="' + safe(m.id) + '">' +
              '<td><code>' + safe(m.id) + '</code></td>' +
              '<td>' + safe(m.name) + '</td>' +
              '<td><code>' + safe(m.service_url || m.serviceUrl) + '</code></td>' +
              '<td>' + githubCell + '</td>' +
              '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
              '</tr>';
          }).join('');

          Array.prototype.forEach.call(bodyEl.querySelectorAll('tr[data-id]'), function (row) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function () {
              var id = row.getAttribute('data-id');
              var mod = (currentModules || []).find(function (m) { return String(m.id) === String(id); });
              if (!mod) return;
              var desc = mod.description || '';
              var service = mod.service_url || mod.serviceUrl || '';
              var github = mod.github_url || mod.githubUrl || '';
              var enabledFlag = mod.enabled === true || mod.enabled === 1;
              var statusEl = document.getElementById('details-status');
              document.getElementById('details-id').textContent = String(mod.id || '');
              document.getElementById('details-name').textContent = String(mod.name || '');
              document.getElementById('details-description').textContent = desc || '—';
              document.getElementById('details-service-url').textContent = service || '—';
              document.getElementById('details-github').innerHTML = github
                ? '<a class="link" href="' + github + '" target="_blank" rel="noopener noreferrer">' + github + '</a>'
                : '<span style="color:#6b7280">—</span>';
              statusEl.textContent = enabledFlag ? 'Enabled' : 'Disabled';
              statusEl.className = 'badge ' + (enabledFlag ? 'badge-on' : 'badge-off');
              var created = mod.created_at || mod.createdAt;
              var updated = mod.updated_at || mod.updatedAt;
              var stampParts = [];
              if (created) stampParts.push('Created ' + created);
              if (updated) stampParts.push('Updated ' + updated);
              document.getElementById('details-timestamps').textContent = stampParts.join(' • ');
              var backdrop = document.getElementById('details-modal-backdrop');
              backdrop.style.display = 'flex';
            });
          });
        } catch (err) {
          console.error(err);
          statusEl.textContent = 'Failed to load modules.';
          bodyEl.innerHTML = '<tr><td colspan="5" style="padding:0.8rem 0.4rem;color:#f97373">Error loading modules.</td></tr>';
        }
      }

      document.getElementById('module-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.target;
        const formStatus = document.getElementById('form-status');
        formStatus.textContent = 'Saving…';
        const payload = {
          id: form.id.value.trim(),
          name: form.name.value.trim(),
          description: form.description.value.trim() || undefined,
          serviceUrl: form.serviceUrl.value.trim(),
          githubUrl: form.githubUrl.value.trim() || undefined,
          enabled: form.enabled.checked,
        };
        try {
          const res = await fetch('/api/modules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error('Request failed with ' + res.status);
          formStatus.textContent = 'Saved.';
          await fetchModules();
        } catch (err) {
          console.error(err);
          formStatus.textContent = 'Failed to save module.';
        }
      });

      document.getElementById('load-example').addEventListener('click', () => {
        const form = document.getElementById('module-form');
        form.id.value = 'example-module';
        form.name.value = 'Example Module';
        form.description.value = 'An example FastAPI module';
        form.serviceUrl.value = 'http://example-module:8000';
        form.githubUrl.value = '';
        form.enabled.checked = true;
      });

      var backdropEl = document.getElementById('details-modal-backdrop');
      var closeEl = document.getElementById('details-close');
      if (backdropEl && closeEl) {
        closeEl.addEventListener('click', function () {
          backdropEl.style.display = 'none';
        });
        backdropEl.addEventListener('click', function (event) {
          if (event.target === backdropEl) {
            backdropEl.style.display = 'none';
          }
        });
      }

      fetchModules();
    </script>
  </body>
</html>`;

    reply.type("text/html");
    return reply.send(html);
  });

  registerModuleRoutes(app);

  return app;
}
