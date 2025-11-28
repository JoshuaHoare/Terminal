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
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-top:0.75rem;margin-bottom:0.5rem;gap:0.75rem">
      <button type="button" id="new-module" class="primary">+ New module</button>
    </div>
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
              <th></th>
            </tr>
          </thead>
          <tbody id="modules-body">
            <tr><td colspan="5" style="padding:0.8rem 0.4rem;color:#6b7280">Loading modules…</td></tr>
          </tbody>
        </table>
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
            <dt>Container name</dt>
            <dd id="details-container-name"></dd>
            <dt>GitHub</dt>
            <dd id="details-github"></dd>
            <dt>Module version</dt>
            <dd id="details-version"></dd>
            <dt>Status</dt>
            <dd><span id="details-status" class="badge"></span></dd>
            <dt>Created / Updated</dt>
            <dd id="details-timestamps"></dd>
          </dl>
          <div style="margin-top:0.8rem;border-top:1px solid #1f2937;padding-top:0.7rem">
            <div class="field">
              <label for="settings-name">Local name</label>
              <input id="settings-name" name="settings-name" placeholder="Friendly name for this instance" />
            </div>
            <div class="field">
              <label for="settings-port">Host port</label>
              <input id="settings-port" name="settings-port" type="number" min="1" max="65535" placeholder="e.g. 8101" />
            </div>
            <div id="settings-status" class="status"></div>
          </div>
        </div>
        <div class="modal-actions">
          <span class="pill"><span class="pill-dot"></span>Module details</span>
          <button type="button" id="settings-save" class="primary">Save settings</button>
        </div>
      </div>
    </div>
    <script>
      let currentModules = [];
      let currentMetadata = {};
      let currentSelectedId = null;

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
            bodyEl.innerHTML = '<tr><td colspan="5" style="padding:0.8rem 0.4rem;color:#6b7280">No modules yet. Use the + New module button to add one.</td></tr>';
            return;
          }
          // Fetch metadata for each module in parallel
          const metadataEntries = await Promise.all(modules.map(async function (m) {
            try {
              const r = await fetch('/api/modules/' + encodeURIComponent(m.id) + '/metadata');
              if (!r.ok) return [m.id, null];
              const meta = await r.json();
              return [m.id, meta];
            } catch (e) {
              return [m.id, null];
            }
          }));

          currentMetadata = {};
          metadataEntries.forEach(function (pair) {
            const id = pair[0];
            const meta = pair[1];
            currentMetadata[id] = meta;
          });

          bodyEl.innerHTML = modules.map(function (m, index) {
            const github = m.github_url || m.githubUrl;
            const enabled = m.enabled === true || m.enabled === 1;
            const hasPort = m.port != null;
            const safe = function (v) { return v == null ? '' : String(v); };
            const githubCell = github
              ? '<a class="link" href="' + github + '" target="_blank" rel="noopener noreferrer">GitHub</a>'
              : '<span style="color:#6b7280">—</span>';
            let statusClass;
            let statusLabel;
            if (!hasPort) {
              statusLabel = 'Configuration';
              statusClass = 'badge-off';
            } else if (enabled) {
              statusLabel = 'Enabled';
              statusClass = 'badge-on';
            } else {
              statusLabel = 'Disabled';
              statusClass = 'badge-off';
            }
            const meta = currentMetadata[m.id] || {};
            const name = meta.name || m.name || m.id;
            const service = m.service_url || m.serviceUrl;
            const position = index + 1;
            return '<tr data-id="' + safe(m.id) + '">' +
              '<td><code>' + safe(position) + '</code></td>' +
              '<td>' + safe(name) + '</td>' +
              '<td><code>' + safe(service) + '</code></td>' +
              '<td>' + githubCell + '</td>' +
              '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
              '<td><button type="button" class="secondary" data-delete="' + safe(m.id) + '">Delete</button></td>' +
              '</tr>';
          }).join('');

          Array.prototype.forEach.call(bodyEl.querySelectorAll('tr[data-id]'), function (row) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function (event) {
              // Ignore clicks on delete button
              if (event.target && event.target.getAttribute && event.target.getAttribute('data-delete')) {
                return;
              }
              const id = row.getAttribute('data-id');
              const mod = (currentModules || []).find(function (m) { return String(m.id) === String(id); });
              if (!mod) return;
              const meta = currentMetadata[mod.id] || {};
              const desc = meta.description || '';
              const service = mod.service_url || mod.serviceUrl || '';
              const github = mod.github_url || mod.githubUrl || '';
              const enabledFlag = mod.enabled === true || mod.enabled === 1;
              const statusEl = document.getElementById('details-status');
              currentSelectedId = String(mod.id || '');
              document.getElementById('details-id').textContent = String(mod.id || '');
              document.getElementById('details-name').textContent = String(meta.name || mod.name || mod.id || '');
              document.getElementById('details-description').textContent = desc || '—';
              document.getElementById('details-service-url').textContent = service || '—';
              const containerName = mod.container_name || mod.containerName || mod.id;
              document.getElementById('details-container-name').textContent = containerName || '—';
              document.getElementById('details-github').innerHTML = github
                ? '<a class="link" href="' + github + '" target="_blank" rel="noopener noreferrer">' + github + '</a>'
                : '<span style="color:#6b7280">—</span>';
              const versionText = meta.version ? String(meta.version) : '—';
              document.getElementById('details-version').textContent = versionText;
              statusEl.textContent = enabledFlag ? 'Enabled' : 'Disabled';
              statusEl.className = 'badge ' + (enabledFlag ? 'badge-on' : 'badge-off');
              const created = mod.created_at || mod.createdAt;
              const updated = mod.updated_at || mod.updatedAt;
              const stampParts = [];
              if (created) stampParts.push('Created ' + created);
              if (updated) stampParts.push('Updated ' + updated);
              document.getElementById('details-timestamps').textContent = stampParts.join(' • ');
              const backdrop = document.getElementById('details-modal-backdrop');
              const settingsName = document.getElementById('settings-name');
              const settingsPort = document.getElementById('settings-port');
              const settingsStatus = document.getElementById('settings-status');
              if (settingsName) settingsName.value = String(mod.name || meta.name || mod.id || '');
              if (settingsPort) settingsPort.value = mod.port != null ? String(mod.port) : '';
              if (settingsStatus) settingsStatus.textContent = '';
              backdrop.style.display = 'flex';
            });
          });

          Array.prototype.forEach.call(bodyEl.querySelectorAll('button[data-delete]'), function (btn) {
            btn.addEventListener('click', async function () {
              const id = btn.getAttribute('data-delete');
              if (!id) return;
              if (!confirm('Delete module "' + id + '" and stop its container?')) return;
              try {
                const r = await fetch('/api/modules/' + encodeURIComponent(id), { method: 'DELETE' });
                if (!r.ok) throw new Error('Delete failed with ' + r.status);
                await fetchModules();
              } catch (err) {
                console.error(err);
                alert('Failed to delete module.');
              }
            });
          });
        } catch (err) {
          console.error(err);
          statusEl.textContent = 'Failed to load modules.';
          bodyEl.innerHTML = '<tr><td colspan="5" style="padding:0.8rem 0.4rem;color:#f97373">Error loading modules.</td></tr>';
        }
      }

      var backdropEl = document.getElementById('details-modal-backdrop');
      var closeEl = document.getElementById('details-close');
      var settingsSaveEl = document.getElementById('settings-save');
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

      var newModuleBtn = document.getElementById('new-module');
      if (newModuleBtn) {
        newModuleBtn.addEventListener('click', async function () {
          var githubUrlInput = prompt('GitHub URL for the new module:');
          if (!githubUrlInput) return;
          var githubUrl = githubUrlInput.trim();
          if (!githubUrl) return;

          // Generate a simple unique logical ID and container name.
          var id = 'mod-' + Date.now();
          var containerName = id;
          var serviceUrl = 'http://' + containerName + ':8000';

          var payload = {
            id: id,
            name: id,
            serviceUrl: serviceUrl,
            githubUrl: githubUrl,
            enabled: false,
            containerName: containerName,
          };

          try {
            var res = await fetch('/api/modules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              alert('Failed to create module (status ' + res.status + ').');
              return;
            }
            await fetchModules();
          } catch (err) {
            console.error(err);
            alert('Error creating module instance.');
          }
        });
      }

      if (settingsSaveEl && backdropEl) {
        settingsSaveEl.addEventListener('click', async function () {
          var id = currentSelectedId;
          if (!id) return;
          var nameInput = document.getElementById('settings-name');
          var portInput = document.getElementById('settings-port');
          var statusEl = document.getElementById('settings-status');
          var name = nameInput ? nameInput.value.trim() : '';
          var portValue = portInput ? portInput.value.trim() : '';
          var port = portValue ? parseInt(portValue, 10) : NaN;
          if (!name || !portValue || !Number.isInteger(port) || port <= 0 || port > 65535) {
            if (statusEl) statusEl.textContent = 'Please provide a valid name and port (1-65535).';
            return;
          }
          if (statusEl) statusEl.textContent = 'Saving settings…';
          try {
            var res2 = await fetch('/api/modules/' + encodeURIComponent(id) + '/configuration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: name, port: port }),
            });
            if (!res2.ok) {
              if (statusEl) statusEl.textContent = 'Failed to save settings (status ' + res2.status + ').';
              return;
            }
            if (statusEl) statusEl.textContent = 'Saved.';
            await fetchModules();
          } catch (err) {
            console.error(err);
            if (statusEl) statusEl.textContent = 'Error saving settings.';
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
