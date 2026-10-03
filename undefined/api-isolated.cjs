"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server/services/postgresDatabase.ts
var postgresDatabase_exports = {};
__export(postgresDatabase_exports, {
  createPostgresDatabase: () => createPostgresDatabase
});
var import_pg, queries, createPostgresDatabase;
var init_postgresDatabase = __esm({
  "src/server/services/postgresDatabase.ts"() {
    "use strict";
    import_pg = require("pg");
    queries = (connection) => ({
      async query(sql, params) {
        const result = await connection.query(sql, params);
        return { rows: result.rows, affectedRows: result.rowCount ?? 0 };
      },
      async exec(sql) {
        await connection.query(sql);
      }
    });
    createPostgresDatabase = (connectionString) => {
      const url = new URL(connectionString);
      if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL_INVALID");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (!local) url.hostname = url.hostname.replace("-pooler", "");
      for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(key);
      const pool = new import_pg.Pool({
        connectionString: url.toString(),
        options: "-c search_path=orcamentos,public",
        ssl: local ? false : { rejectUnauthorized: process.env.DB_SSL_VERIFY !== "false" },
        max: 5,
        connectionTimeoutMillis: 1e4,
        idleTimeoutMillis: 3e4,
        statement_timeout: 3e4,
        idle_in_transaction_session_timeout: 3e4,
        // PGlite exposes SQL DATE as YYYY-MM-DD; pg defaults to a timezone-sensitive Date.
        types: { getTypeParser: (oid, format) => oid === 1082 ? (value) => value : import_pg.types.getTypeParser(oid, format) }
      });
      pool.on("error", () => console.error("POSTGRES_IDLE_CONNECTION_ERROR"));
      return {
        ...queries(pool),
        async transaction(callback) {
          const client = await pool.connect();
          let discard = false;
          try {
            await client.query("BEGIN");
            await client.query("SELECT pg_advisory_xact_lock(178241, 2)");
            const result = await callback(queries(client));
            const committed = await client.query("COMMIT");
            if (committed.command !== "COMMIT") throw new Error("TRANSACTION_ABORTED");
            return result;
          } catch (error) {
            try {
              await client.query("ROLLBACK");
            } catch {
              discard = true;
            }
            throw error;
          } finally {
            client.release(discard);
          }
        },
        close: () => pool.end(),
        async dumpDataDir() {
          throw new Error("REMOTE_BACKUP_UNSUPPORTED");
        }
      };
    };
  }
});

// scripts/start-api-isolated.ts
var import_node_path2 = __toESM(require("node:path"));
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");

// src/server/startApiServer.ts
var import_node_crypto17 = require("node:crypto");

// src/server/createApp.ts
var import_node_crypto16 = require("node:crypto");
var import_express15 = __toESM(require("express"));
var import_zod13 = require("zod");

// src/server/routes/auth.ts
var import_express = require("express");
var import_zod = require("zod");

// src/server/services/auth.ts
var import_node_crypto = require("node:crypto");

// src/server/services/centroIdentity.ts
var DEFAULT_IDENTITY_URL = "https://centro-custos-api.construtec-reports.workers.dev";
var MIN_SERVICE_KEY_LENGTH = 32;
var TIMEOUT_MS = 8e3;
var CentroIdentityError = class extends Error {
  constructor(message, status, code = "") {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "CentroIdentityError";
  }
  status;
  code;
};
var identityUrl = () => String(process.env.CENTRO_CUSTOS_IDENTITY_URL || DEFAULT_IDENTITY_URL).replace(/\/+$/, "");
var serviceKey = () => {
  const key = (process.env.CONSTRUTEC_IDENTITY_KEY || "").replace(/^\uFEFF/, "").trim();
  return key.length >= MIN_SERVICE_KEY_LENGTH ? key : "";
};
var call = async (path3, options = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.service) {
    const key = serviceKey();
    if (!key) throw new CentroIdentityError("Integra\xE7\xE3o de contas com o Centro de Custos n\xE3o configurada neste servidor.", 503, "IDENTITY_NOT_CONFIGURED");
    headers["X-Construtec-Identity-Key"] = key;
  }
  if (options.clientIp && serviceKey()) {
    headers["X-Construtec-Identity-Key"] = serviceKey();
    headers["X-Construtec-Client-IP"] = options.clientIp;
  }
  let response;
  try {
    response = await fetch(`${identityUrl()}${path3}`, {
      method: options.method || "GET",
      headers,
      body: options.body === void 0 ? void 0 : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    const inner = error?.cause;
    const cause = inner ? [inner.name, inner.code, inner.errors?.map((item) => item.code).join("/"), inner.message].filter(Boolean).join(" ").slice(0, 160) : String(error?.message || error?.name || "erro").slice(0, 160);
    console.error("[centro-identity] sem conexao", path3, cause);
    throw new CentroIdentityError("N\xE3o foi poss\xEDvel conectar ao Centro de Custos para validar o acesso. Verifique a internet e tente novamente.", 503, "IDENTITY_UNAVAILABLE");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new CentroIdentityError(String(data.error || `Centro de Custos respondeu HTTP ${response.status}.`), response.status, String(data.code || ""));
  }
  return data;
};
var centroLogin = (email, password, clientIp2) => call("/v1/auth/login", {
  method: "POST",
  body: { email, password },
  clientIp: clientIp2
});
var centroSession = (token3) => call("/v1/auth/session", { token: token3, service: Boolean(serviceKey()) });
var centroConsumeHandoff = (code) => call("/v1/auth/handoff/consume", {
  method: "POST",
  service: true,
  body: { code, target: "orcamentos" }
});
var centroPermissions = (token3) => call("/v1/permissions", { token: token3 });
var centroLogout = (token3) => call("/v1/auth/logout", { method: "POST", token: token3 });
var centroListUsers = (token3) => call("/v1/users", { token: token3, service: true });
var centroCreateUser = (token3, input) => call("/v1/users", { method: "POST", token: token3, service: true, body: input });
var centroSetUserStatus = (token3, email, active, id) => call("/v1/users/status", { method: "POST", token: token3, service: true, body: { email, active, id: id || void 0 } });
var centroDeleteUser = (token3, email, id) => call("/v1/users/delete", { method: "POST", token: token3, service: true, body: { email, id: id || void 0 } });
var centroListAuthorizedEmails = (token3) => call("/v1/authorized-emails", { token: token3, service: true });
var centroAuthorizeEmail = (token3, email, note) => call("/v1/authorized-emails", { method: "POST", token: token3, service: true, body: { email, note } });
var centroRevokeEmail = (token3, email) => call("/v1/authorized-emails/revoke", { method: "POST", token: token3, service: true, body: { email } });
var centroNotifications = (token3, path3, method = "GET", body, query = "") => call(`${path3}${query}`, { method, token: token3, body });

// src/shared/suitePermissions.ts
var SUITE_ROLES = ["admin", "gestor", "financeiro", "engenharia", "tecnico", "comercial"];
var SUITE_APPS = ["centro", "orcamentos"];
var MATRIX = {
  p1: ["admin", "gestor", "financeiro", "engenharia"],
  p2: ["admin", "gestor", "financeiro", "engenharia", "tecnico"],
  p3: ["admin", "gestor", "financeiro"],
  p4: ["admin", "gestor", "financeiro"],
  p5: ["admin", "gestor"],
  p6: ["admin", "gestor", "financeiro"],
  p7: ["admin", "gestor"],
  p8: ["admin"],
  p9: ["admin"],
  p10: ["admin", "gestor", "engenharia", "comercial"],
  p11: ["admin", "gestor", "comercial"],
  p12: ["admin", "gestor", "engenharia", "tecnico"]
};
var SUITE_PERMISSIONS = Object.keys(MATRIX);
var defaultSuiteMatrix = () => {
  const out = {};
  for (const role of SUITE_ROLES) {
    out[role] = {};
    for (const permission of SUITE_PERMISSIONS) out[role][permission] = MATRIX[permission].includes(role);
  }
  return out;
};
var isSuiteRole = (value) => SUITE_ROLES.includes(value);
var suiteRoleFromLegacy = (role) => role === "admin" || role === "gestor" ? role : "tecnico";
var permissionsFor = (role, matrix = defaultSuiteMatrix()) => SUITE_PERMISSIONS.filter((permission) => role === "admin" || matrix[role]?.[permission] === true);

// src/server/services/suiteAccess.ts
var MATRIX_CACHE_MS = 60 * 1e3;
var matrixCache = null;
var loadMatrix = async (token3) => {
  if (matrixCache && matrixCache.until > Date.now()) return matrixCache.matrix;
  try {
    const data = await centroPermissions(token3);
    if (data?.matrix?.admin) {
      matrixCache = { matrix: data.matrix, until: Date.now() + MATRIX_CACHE_MS };
      return matrixCache.matrix;
    }
  } catch (error) {
    if (!(error instanceof CentroIdentityError) || error.status !== 404) console.warn("suite_matrix_unavailable");
  }
  return matrixCache?.matrix ?? defaultSuiteMatrix();
};
var resolveSuiteAccess = async (remote, token3) => {
  const suiteRole = isSuiteRole(remote.suiteRole) ? remote.suiteRole : suiteRoleFromLegacy(remote.role);
  const apps = Array.isArray(remote.apps) ? remote.apps.filter((app) => SUITE_APPS.includes(app)) : [...SUITE_APPS];
  return { suiteRole, apps, permissions: permissionsFor(suiteRole, await loadMatrix(token3)) };
};
var hasPermission = (user, permission) => Array.isArray(user.permissions) ? user.permissions.includes(permission) : user.role === "admin";

// src/server/services/auth.ts
var SESSION_CACHE_MS = 60 * 1e3;
var MAX_CACHE_ENTRIES = 1e3;
var sessionCache = /* @__PURE__ */ new Map();
var cacheGeneration = 0;
var OFFLINE_GRACE_MS = 12 * 60 * 60 * 1e3;
var lastConfirmed = /* @__PURE__ */ new Map();
var MIRROR_COLUMNS = "id, name, email, role, active, centro_user_id, centro_admin, local_role";
var toAuthUser = (row, access = {}) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
  ...access
});
var retireLocalUsers = async (database, ids) => {
  if (!ids.length) return;
  await database.query(
    "UPDATE users SET deleted_at = now(), active = false, updated_at = now() WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL",
    [ids]
  );
};
var mirrorCentroUser = async (database, remote, initialRole) => {
  try {
    return await mirrorOnce(database, remote, initialRole);
  } catch (error) {
    if (!/duplicate key|unique constraint/i.test(String(error?.message))) throw error;
    return mirrorOnce(database, remote, initialRole);
  }
};
var mirrorOnce = async (database, remote, initialRole) => {
  const email = remote.email.trim().toLowerCase();
  const byId = await database.query(
    `SELECT ${MIRROR_COLUMNS} FROM users WHERE centro_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [remote.id]
  );
  let existing = byId.rows[0];
  if (!existing) {
    const byEmail = await database.query(
      `SELECT ${MIRROR_COLUMNS} FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
      [email]
    );
    existing = byEmail.rows[0];
    if (existing?.centro_user_id && existing.centro_user_id !== remote.id) {
      await retireLocalUsers(database, [existing.id]);
      existing = void 0;
    }
  }
  const centroAdmin = remote.role === "admin";
  if (existing) {
    const localRole = existing.centro_user_id ? existing.local_role : initialRole ?? null;
    if (existing.email.toLowerCase() !== email) {
      await database.query(
        "UPDATE users SET deleted_at = now(), active = false, updated_at = now() WHERE lower(email) = $1 AND id <> $2 AND deleted_at IS NULL",
        [email, existing.id]
      );
    }
    const updated = await database.query(`
      UPDATE users SET name = $2, email = $3, active = $4, centro_user_id = $5,
        role = $6, centro_admin = $7, local_role = $8, password_hash = NULL, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${MIRROR_COLUMNS}
    `, [existing.id, remote.name, email, remote.active !== false, remote.id, centroAdmin ? "admin" : localRole ?? "viewer", centroAdmin, localRole]);
    if (updated.rows[0]) return updated.rows[0];
  }
  const inserted = await database.query(`
    INSERT INTO users (id, name, email, password_hash, role, active, centro_user_id, centro_admin, local_role)
    VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8)
    RETURNING ${MIRROR_COLUMNS}
  `, [(0, import_node_crypto.randomUUID)(), remote.name, email, centroAdmin ? "admin" : initialRole ?? "viewer", remote.active !== false, remote.id, centroAdmin, initialRole ?? null]);
  return inserted.rows[0];
};
var getAuthSetupStatus = async () => ({ requiresSetup: false });
var loginUser = async (database, email, password, clientIp2) => {
  let remote;
  try {
    remote = await centroLogin(email.trim().toLowerCase(), password, clientIp2);
  } catch (error) {
    if (error instanceof CentroIdentityError && [400, 401].includes(error.status)) throw new Error("AUTH_INVALID_CREDENTIALS");
    throw error;
  }
  const row = await mirrorCentroUser(database, remote.user);
  if (!row.active) throw new Error("AUTH_INVALID_CREDENTIALS");
  const user = toAuthUser(row, await resolveSuiteAccess(remote.user, remote.sessionToken));
  sessionCache.set(remote.sessionToken, { user, until: Date.now() + SESSION_CACHE_MS });
  lastConfirmed.set(remote.sessionToken, { user, at: Date.now() });
  return { token: remote.sessionToken, user };
};
var consumeHandoff = async (database, code) => {
  let remote;
  try {
    remote = await centroConsumeHandoff(code);
  } catch (error) {
    if (error instanceof CentroIdentityError && error.status === 400) throw new Error("AUTH_HANDOFF_INVALID");
    throw error;
  }
  const row = await mirrorCentroUser(database, remote.user);
  if (!row.active) throw new Error("AUTH_INVALID_CREDENTIALS");
  const user = toAuthUser(row, await resolveSuiteAccess(remote.user, remote.sessionToken));
  sessionCache.set(remote.sessionToken, { user, until: Date.now() + SESSION_CACHE_MS });
  lastConfirmed.set(remote.sessionToken, { user, at: Date.now() });
  return { token: remote.sessionToken, user };
};
var verifyUserSession = async (database, token3) => {
  if (!token3) return null;
  const cached = sessionCache.get(token3);
  if (cached && cached.until > Date.now()) return cached.user;
  const generation = cacheGeneration;
  try {
    const remote = await centroSession(token3);
    const row = await mirrorCentroUser(database, remote.user);
    if (!row.active) return null;
    const user = toAuthUser(row, await resolveSuiteAccess(remote.user, token3));
    if (generation === cacheGeneration) {
      if (sessionCache.size >= MAX_CACHE_ENTRIES) sessionCache.clear();
      sessionCache.set(token3, { user, until: Date.now() + SESSION_CACHE_MS });
      if (lastConfirmed.size >= MAX_CACHE_ENTRIES) lastConfirmed.clear();
      lastConfirmed.set(token3, { user, at: Date.now() });
    }
    return user;
  } catch (error) {
    sessionCache.delete(token3);
    if (error instanceof CentroIdentityError && error.status === 401) {
      lastConfirmed.delete(token3);
      return null;
    }
    const confirmed = lastConfirmed.get(token3);
    const offlineDesktop = !process.env.DATABASE_URL && error instanceof CentroIdentityError && error.code === "IDENTITY_UNAVAILABLE";
    if (offlineDesktop && confirmed && Date.now() - confirmed.at < OFFLINE_GRACE_MS && generation === cacheGeneration) return confirmed.user;
    throw error;
  }
};
var logoutUser = async (token3) => {
  sessionCache.delete(token3);
  lastConfirmed.delete(token3);
  if (token3) await centroLogout(token3).catch(() => void 0);
};
var forgetCachedSessions = () => {
  cacheGeneration += 1;
  sessionCache.clear();
  lastConfirmed.clear();
};

// src/server/routes/auth.ts
var credentialsSchema = import_zod.z.object({
  email: import_zod.z.string().trim().email().max(254),
  password: import_zod.z.string().min(1).max(128),
  rememberMe: import_zod.z.boolean().optional()
});
var handoffSchema = import_zod.z.object({ code: import_zod.z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
var sessionToken = (request) => {
  const value = request.headers["x-construtec-session"];
  return typeof value === "string" ? value : "";
};
var clientIp = (request) => {
  if (!process.env.DATABASE_URL) return void 0;
  const value = request.headers["cf-connecting-ip"];
  return typeof value === "string" && value ? value : void 0;
};
var createAuthRouter = (database) => {
  const router = (0, import_express.Router)();
  router.get("/setup-status", async (_request, response, next) => {
    try {
      response.json(await getAuthSetupStatus());
    } catch (error) {
      next(error);
    }
  });
  router.post("/setup", (_request, response) => {
    response.status(410).json({ error: "Entre com uma conta do Centro de Custos ou pe\xE7a a um administrador para criar a sua." });
  });
  router.post("/login", async (request, response, next) => {
    try {
      const input = credentialsSchema.parse(request.body);
      response.json(await loginUser(database, input.email, input.password, clientIp(request)));
    } catch (error) {
      next(error);
    }
  });
  router.post("/handoff", async (request, response, next) => {
    try {
      const input = handoffSchema.parse(request.body);
      response.json(await consumeHandoff(database, input.code));
    } catch (error) {
      next(error);
    }
  });
  router.post("/logout", async (request, response, next) => {
    try {
      await logoutUser(sessionToken(request));
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  router.get("/me", async (request, response, next) => {
    try {
      const user = await verifyUserSession(database, sessionToken(request));
      if (!user) {
        response.status(401).json({ error: "Sess\xE3o de usu\xE1rio inv\xE1lida ou expirada." });
        return;
      }
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/catalog.ts
var import_express2 = require("express");
var import_zod2 = require("zod");

// src/server/services/catalog.ts
var import_node_crypto2 = require("node:crypto");
var mapProduct = (product) => ({
  id: product.id,
  code: product.code,
  manufacturer: product.manufacturer,
  model: product.model,
  description: product.description,
  category: product.category,
  unit: product.unit,
  currentCost: Number(product.current_cost),
  source: product.source,
  active: product.active,
  updatedAt: product.updated_at
});
var listCatalogProducts = async (database, query = "") => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query(`
    SELECT id, code, manufacturer, model, description, category, unit,
      current_cost::text, source, active, updated_at::text
    FROM products
    WHERE $1 = '%%' OR code ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1
      OR model ILIKE $1 OR category ILIKE $1
    ORDER BY active DESC, category, code
    LIMIT 300
  `, [pattern]);
  return result.rows.map(mapProduct);
};
var createCatalogProduct = async (database, input) => {
  const productId = (0, import_node_crypto2.randomUUID)();
  await database.transaction(async (transaction) => {
    const duplicate = await transaction.query("SELECT id FROM products WHERE lower(code) = lower($1)", [input.code.trim()]);
    if (duplicate.rows[0]) throw new Error("PRODUCT_DUPLICATE");
    await transaction.query(`
      INSERT INTO products
        (id, code, manufacturer, model, description, category, unit, current_cost, source, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
    `, [
      productId,
      input.code.trim().toUpperCase(),
      input.manufacturer?.trim() || null,
      input.model?.trim() || null,
      input.description.trim(),
      input.category.trim(),
      input.unit.trim().toLowerCase(),
      input.currentCost,
      input.source?.trim() || "CONSTRUTEC"
    ]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'product', $2, 'created', $3::jsonb)
    `, [(0, import_node_crypto2.randomUUID)(), productId, JSON.stringify(input)]);
  });
  return productId;
};
var updateCatalogProduct = async (database, productId, input) => {
  await database.transaction(async (transaction) => {
    const before = await transaction.query(`
      SELECT id, code, manufacturer, model, description, category, unit,
        current_cost::text, source, active, updated_at::text
      FROM products WHERE id = $1 FOR UPDATE
    `, [productId]);
    if (!before.rows[0]) throw new Error("PRODUCT_NOT_FOUND");
    const duplicate = await transaction.query(
      "SELECT id FROM products WHERE lower(code) = lower($1) AND id <> $2",
      [input.code.trim(), productId]
    );
    if (duplicate.rows[0]) throw new Error("PRODUCT_DUPLICATE");
    await transaction.query(`
      UPDATE products
      SET code = $2, manufacturer = $3, model = $4, description = $5, category = $6,
          unit = $7, current_cost = $8, source = $9, active = $10,
          revision = revision + 1, updated_at = now()
      WHERE id = $1
    `, [
      productId,
      input.code.trim().toUpperCase(),
      input.manufacturer?.trim() || null,
      input.model?.trim() || null,
      input.description.trim(),
      input.category.trim(),
      input.unit.trim().toLowerCase(),
      input.currentCost,
      input.source?.trim() || "CONSTRUTEC",
      input.active ?? true
    ]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'product', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto2.randomUUID)(), productId, JSON.stringify(before.rows[0]), JSON.stringify(input)]);
  });
};
var normalizedItem = (item) => ({
  code: item.code.trim().toUpperCase(),
  manufacturer: item.manufacturer?.trim() || null,
  model: item.model?.trim() || null,
  description: item.description.trim(),
  category: item.category.trim(),
  unit: item.unit.trim().toLowerCase(),
  currentCost: Number(item.currentCost),
  source: item.source.trim() || "IMPORTA\xC7\xC3O",
  active: item.active
});
var listCatalogUnits = async (database) => (await database.query(
  "SELECT lower(unit) AS unit, count(*)::text AS total FROM products GROUP BY lower(unit) ORDER BY count(*) DESC, lower(unit) LIMIT 60"
)).rows.map((row) => ({ unit: row.unit, total: Number(row.total) }));
var isExsatItem = (item) => item.source.trim().toUpperCase().startsWith("EXSAT");
var previewCatalogImport = async (database, items) => {
  const codes = items.map((item) => item.code.trim()).filter(Boolean);
  const existing = codes.length === 0 ? [] : (await database.query(`
    SELECT id, code, manufacturer, model, description, category, unit,
      current_cost::text, source, active, updated_at::text
    FROM products
    WHERE lower(code) = ANY($1::text[])
  `, [codes.map((code) => code.toLowerCase())])).rows;
  const byCode = new Map(existing.map((row) => [row.code.toLowerCase(), row]));
  const previewItems = items.map((item) => {
    const normalized = normalizedItem(item);
    if (isExsatItem(item) && (!Number.isFinite(normalized.currentCost) || normalized.currentCost <= 0)) return { ...item, status: "no_price" };
    const current = byCode.get(normalized.code.toLowerCase());
    if (!current) return { ...item, status: "new" };
    const previous = {
      description: current.description,
      category: current.category,
      unit: current.unit,
      currentCost: Number(current.current_cost),
      manufacturer: current.manufacturer ?? null,
      model: current.model ?? null,
      source: current.source
    };
    const unchanged = (current.manufacturer ?? null) === normalized.manufacturer && (current.model ?? null) === normalized.model && current.description.trim() === normalized.description && current.category.trim() === normalized.category && current.unit.trim().toLowerCase() === normalized.unit && Number(current.current_cost) === normalized.currentCost && current.source.trim() === normalized.source && current.active === normalized.active;
    return { ...item, status: unchanged ? "unchanged" : "updated", previous };
  });
  return {
    items: previewItems,
    summary: {
      new: previewItems.filter((item) => item.status === "new").length,
      updated: previewItems.filter((item) => item.status === "updated").length,
      unchanged: previewItems.filter((item) => item.status === "unchanged").length,
      noPrice: previewItems.filter((item) => item.status === "no_price").length
    }
  };
};
var importCatalogProducts = async (database, items) => {
  const safeItems = items.filter((item) => !isExsatItem(item) || Number.isFinite(item.currentCost) && item.currentCost > 0);
  return database.transaction(async (transaction) => {
    let created = 0;
    let updated = 0;
    for (const input of safeItems) {
      const code = input.code.trim().toUpperCase();
      const existing = await transaction.query(
        "SELECT id FROM products WHERE lower(code) = lower($1) FOR UPDATE",
        [code]
      );
      if (existing.rows[0]) {
        await transaction.query(`
          UPDATE products
          SET manufacturer = $2, model = $3, description = $4, category = $5, unit = $6,
              current_cost = $7, source = $8, active = $9, revision = revision + 1, updated_at = now()
          WHERE id = $1
        `, [
          existing.rows[0].id,
          input.manufacturer?.trim() || null,
          input.model?.trim() || null,
          input.description.trim(),
          input.category.trim(),
          input.unit.trim().toLowerCase(),
          input.currentCost,
          input.source.trim() || "IMPORTA\xC7\xC3O",
          input.active
        ]);
        updated += 1;
      } else {
        await transaction.query(`
          INSERT INTO products
            (id, code, manufacturer, model, description, category, unit, current_cost, source, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          (0, import_node_crypto2.randomUUID)(),
          code,
          input.manufacturer?.trim() || null,
          input.model?.trim() || null,
          input.description.trim(),
          input.category.trim(),
          input.unit.trim().toLowerCase(),
          input.currentCost,
          input.source.trim() || "IMPORTA\xC7\xC3O",
          input.active
        ]);
        created += 1;
      }
    }
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'catalog', $2, 'batch_imported', $3::jsonb)
    `, [(0, import_node_crypto2.randomUUID)(), (0, import_node_crypto2.randomUUID)(), JSON.stringify({ created, updated, ignored: items.length - safeItems.length, codes: safeItems.map((item) => item.code) })]);
    return { created, updated, ignored: items.length - safeItems.length };
  });
};
var decodeHtml = (value) => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
var parsePrice = (value) => {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) ? price : 0;
};
var totalPrice = (values) => Math.max(0, ...values.map(parsePrice));
var isAdministrativeExsatText = (description) => /\b(?:cliente|construtora|construtec|engenharia|ltda|cnpj|cpf|endere[cç]o|or[cç]amento|vendedor|comprador|representante|telefone|email|carrinho|categoria)\b/i.test(description);
var parseExsatProductsHtml = (html, includeMissingPrice = false) => {
  if (html.length > 8e6) throw new Error("EXSAT_UNAVAILABLE");
  const category = decodeHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") || "Exsat";
  const items = /* @__PURE__ */ new Map();
  for (const match of html.matchAll(/\{\s*["']id["']\s*:\s*["']([A-Za-z0-9_-]{3,60})["']\s*,\s*["']name["']\s*:\s*["']([^"']+)["']\s*,\s*["']brand["']\s*:\s*["']([^"']*)["']\s*,\s*["']category["']\s*:\s*["']([^"']*)["'][\s\S]*?["']price["']\s*:\s*["']([\d.]+)["']/gi)) {
    const [, code, description, manufacturer, itemCategory, price] = match;
    const currentCost = parsePrice(price);
    if (!description || currentCost <= 0 && !includeMissingPrice) continue;
    items.set(code.toUpperCase(), {
      code: code.toUpperCase(),
      manufacturer: manufacturer || null,
      model: null,
      description: decodeHtml(description),
      category: decodeHtml(itemCategory) || category,
      unit: "un",
      currentCost,
      source: "EXSAT",
      active: true
    });
  }
  for (const match of html.matchAll(/C[oó]digo\s*:\s*(?:<[^>]+>\s*)*([A-Za-z0-9_-]{3,60})/gi)) {
    const code = match[1].toUpperCase();
    const start = match.index ?? 0;
    const after = html.slice(start + match[0].length, start + match[0].length + 1800);
    const before = html.slice(Math.max(0, start - 900), start);
    const headingAfter = after.match(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/i)?.[1];
    const headingBefore = [...before.matchAll(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/gi)].at(-1)?.[1];
    const productLink = after.match(/<a\b[^>]*(?:product|produto)[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const description = decodeHtml(headingAfter ?? productLink ?? headingBefore ?? "");
    if (!description || /produto não encontrado/i.test(description) || isAdministrativeExsatText(description)) continue;
    const currentCost = totalPrice(after.match(/R\$\s*[\d.]+,\d{2}/gi) ?? []);
    if (currentCost <= 0 && !includeMissingPrice) continue;
    if (!items.has(code)) items.set(code, {
      code,
      manufacturer: /intelbras/i.test(description) ? "Intelbras" : null,
      model: null,
      description,
      category,
      unit: "un",
      currentCost,
      source: "EXSAT",
      active: true
    });
  }
  const lines = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:a|article|button|div|h[1-6]|li|option|p|section|td|tr)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const isCatalogCode = (value) => /^[A-Za-z0-9][A-Za-z0-9./_-]{2,59}$/.test(value) && /\d/.test(value);
  const isProductDescription = (value) => value.length >= 3 && value.length <= 240 && /[A-Za-zÀ-ÿ]/.test(value) && !isAdministrativeExsatText(value) && !/^(?:ver produto|ver mais produtos|faça seu login|para ver o preço|criar minha conta|quero ser um revendedor|subtotal|atendimento|newsletter|comercial|políticas|termos e condições|política privacidade)$/i.test(value);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const rawCode = lines[index];
    if (/^(?:ver mais produtos|©\s*exsat|cnpj\s*:)/i.test(rawCode)) break;
    if (!isCatalogCode(rawCode)) continue;
    const code = rawCode.toUpperCase();
    let description = "";
    let descriptionIndex = -1;
    for (let offset = index + 1; offset < Math.min(lines.length, index + 6); offset += 1) {
      if (isCatalogCode(lines[offset])) break;
      if (isProductDescription(lines[offset])) {
        description = lines[offset];
        descriptionIndex = offset;
        break;
      }
    }
    if (!description) continue;
    const prices = [];
    for (let offset = descriptionIndex + 1; offset < Math.min(lines.length, descriptionIndex + 7); offset += 1) {
      if (isCatalogCode(lines[offset])) break;
      prices.push(...lines[offset].match(/R\$\s*[\d.]+,\d{2}/gi) ?? []);
    }
    const currentCost = totalPrice(prices);
    if (currentCost <= 0 && !includeMissingPrice) continue;
    const previous = items.get(code);
    if (!previous || previous.currentCost <= 0 && currentCost > 0) {
      items.set(code, {
        code,
        manufacturer: /intelbras/i.test(description) ? "Intelbras" : null,
        model: null,
        description,
        category,
        unit: "un",
        currentCost,
        source: "EXSAT",
        active: true
      });
    }
  }
  if (items.size === 0) throw new Error("EXSAT_NO_PRODUCTS");
  return [...items.values()].slice(0, 500);
};
var validateExsatUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !["exsat.com.br", "www.exsat.com.br"].includes(url.hostname.toLowerCase())) {
    throw new Error("EXSAT_URL_INVALID");
  }
  return url;
};
var previewExsatProducts = async (rawUrl) => {
  const url = validateExsatUrl(rawUrl);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(2e4),
    headers: { "User-Agent": "Construtec-Orcamentos/1.0 (+catalog-import)" }
  });
  if (!response.ok) throw new Error("EXSAT_UNAVAILABLE");
  const html = await response.text();
  return parseExsatProductsHtml(html);
};

// src/server/services/auditAttribution.ts
var attributeAuditEvent = async (database, userId, entityType, entityId, action) => {
  const result = await database.query(`
    WITH target AS (
      SELECT id
      FROM audit_events
      WHERE user_id IS NULL
        AND entity_type = $1
        AND entity_id = $2
        AND action = $3
      ORDER BY occurred_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $4
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [entityType, entityId, action, userId]);
  return Boolean(result.rows[0]);
};
var attributeCreatedProposalItemAudit = async (database, userId, proposalId, productId) => {
  const result = await database.query(`
    WITH target AS (
      SELECT event.id
      FROM audit_events event
      JOIN proposal_items item ON item.id = event.entity_id
      WHERE event.user_id IS NULL
        AND event.entity_type = 'proposal_item'
        AND event.action = 'created'
        AND item.proposal_id = $1
        AND item.catalog_product_id = $2
      ORDER BY event.occurred_at DESC, item.created_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $3
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [proposalId, productId, userId]);
  return Boolean(result.rows[0]);
};
var attributeDuplicatedProposalItemAudit = async (database, userId, proposalId, sourceItemId) => {
  const result = await database.query(`
    WITH target AS (
      SELECT event.id
      FROM audit_events event
      JOIN proposal_items item ON item.id = event.entity_id
      WHERE event.user_id IS NULL
        AND event.entity_type = 'proposal_item'
        AND event.action = 'duplicated'
        AND item.proposal_id = $1
        AND event.before_data->>'sourceItemId' = $2
      ORDER BY event.occurred_at DESC, item.created_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $3
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [proposalId, sourceItemId, userId]);
  return Boolean(result.rows[0]);
};
var attributeCatalogBatchAudit = async (database, userId, codes, summary) => {
  const result = await database.query(`
    WITH target AS (
      SELECT id
      FROM audit_events
      WHERE user_id IS NULL
        AND entity_type = 'catalog'
        AND action = 'batch_imported'
        AND after_data->'codes' = $1::jsonb
        AND (after_data->>'created')::integer = $2
        AND (after_data->>'updated')::integer = $3
        AND (after_data->>'ignored')::integer = $4
      ORDER BY occurred_at DESC
      LIMIT 1
    )
    UPDATE audit_events event
    SET user_id = $5
    FROM target
    WHERE event.id = target.id
    RETURNING event.id
  `, [JSON.stringify(codes), summary.created, summary.updated, summary.ignored, userId]);
  return Boolean(result.rows[0]);
};

// src/server/services/catalogOverview.ts
var NEW_DAYS = 7;
var MIN_DIFF = 0.01;
var NEW_LIST_LIMIT = 50;
var CHANGED_LIST_LIMIT = 200;
var round1 = (value) => Math.round(value * 10) / 10;
var getCatalogOverview = async (database, withCost) => {
  const usage = await database.query(`
    SELECT pi.snapshot_code AS code, p.id AS proposal_id, p.proposal_number, p.revision, p.status,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name,
      pi.snapshot_unit_cost::text AS snap, pr.current_cost::text AS cur, pr.active
    FROM proposal_items pi
    JOIN proposals p ON p.id = pi.proposal_id
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN products pr ON pr.code = pi.snapshot_code
    WHERE NOT EXISTS (SELECT 1 FROM proposals newer WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision)
    ORDER BY p.proposal_number, pi.snapshot_code
  `);
  const byCode = /* @__PURE__ */ new Map();
  const frozen = /* @__PURE__ */ new Map();
  for (const row of usage.rows) {
    const entry = byCode.get(row.code) ?? { code: row.code, usedIn: [], isNew: false, biggest: 0 };
    if (!entry.usedIn.includes(row.proposal_number)) entry.usedIn.push(row.proposal_number);
    const snap = Number(row.snap), cur = row.cur === null ? null : Number(row.cur);
    const differs = cur !== null && row.active === true && Math.abs(cur - snap) >= MIN_DIFF;
    if (differs && row.status === "draft" && cur !== null) {
      const pct = snap > 0 ? round1((cur / snap - 1) * 100) : 0;
      if (entry.changePercent === void 0 || Math.abs(pct) > entry.biggest) {
        entry.biggest = Math.abs(pct);
        entry.changePercent = pct;
        if (withCost) {
          entry.fromUnit = snap;
          entry.toUnit = cur;
        }
      }
    }
    if (differs && row.status !== "draft") {
      const current = frozen.get(row.proposal_id) ?? {
        id: row.proposal_id,
        number: row.proposal_number,
        revision: row.revision,
        status: row.status,
        clientName: row.client_name,
        workName: row.work_name,
        itemCount: 0
      };
      current.itemCount += 1;
      frozen.set(row.proposal_id, current);
    }
    byCode.set(row.code, entry);
  }
  const counts = await database.query(`
    SELECT count(*)::text AS total, count(*) FILTER (WHERE created_at >= now() - ($1 || ' days')::interval)::text AS fresh FROM products
  `, [String(NEW_DAYS)]);
  const fresh = await database.query(`
    SELECT code, description, category, unit, current_cost::text FROM products
    WHERE created_at >= now() - ($1 || ' days')::interval
    ORDER BY created_at DESC, code LIMIT ${NEW_LIST_LIMIT}
  `, [String(NEW_DAYS)]);
  const freshCodes = new Set(fresh.rows.map((row) => row.code));
  for (const code of freshCodes) {
    const entry = byCode.get(code) ?? { code, usedIn: [], isNew: true, biggest: 0 };
    entry.isNew = true;
    byCode.set(code, entry);
  }
  const changedCodes = [...byCode.values()].filter((entry) => entry.changePercent !== void 0).map((entry) => entry.code).slice(0, CHANGED_LIST_LIMIT);
  const changed = changedCodes.length === 0 ? [] : (await database.query(`
    SELECT code, description, category, unit, current_cost::text FROM products WHERE code = ANY($1::text[]) ORDER BY code
  `, [changedCodes])).rows;
  const toListItem = (row) => ({
    code: row.code,
    description: row.description,
    category: row.category,
    unit: row.unit,
    ...withCost ? { currentCost: Number(row.current_cost) } : {}
  });
  const items = [...byCode.values()].map(({ biggest, ...rest }) => {
    void biggest;
    return rest;
  });
  return {
    productCount: Number(counts.rows[0]?.total ?? 0),
    newCount: Number(counts.rows[0]?.fresh ?? 0),
    items,
    newItems: fresh.rows.map(toListItem),
    changedItems: changed.map(toListItem),
    frozenProposals: [...frozen.values()]
  };
};

// src/shared/decimal.ts
var fraction = (value) => {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error("FINANCIAL_VALUE_INVALID");
  const scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
  if (Math.abs(scale) > 100) throw new Error("FINANCIAL_VALUE_INVALID");
  const numerator = BigInt(match[2] + (match[3] ?? "")) * (match[1] ? -1n : 1n);
  return scale >= 0 ? { numerator, denominator: 10n ** BigInt(scale) } : { numerator: numerator * 10n ** BigInt(-scale), denominator: 1n };
};
var rounded = ({ numerator, denominator }, decimals) => {
  if (denominator === 0n) throw new Error("FINANCIAL_VALUE_INVALID");
  const factor = 10n ** BigInt(decimals);
  const negative = numerator < 0n !== denominator < 0n;
  const absolute = (numerator < 0n ? -numerator : numerator) * factor;
  const divisor = denominator < 0n ? -denominator : denominator;
  const units = absolute / divisor + (absolute % divisor * 2n >= divisor ? 1n : 0n);
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("FINANCIAL_TOTAL_TOO_LARGE");
  return Number(negative ? -units : units) / Number(factor);
};
var roundDecimal = (value, decimals = 2) => rounded(fraction(value), decimals);
var sumDecimal = (values, decimals = 2) => rounded(values.reduce(
  (sum, value) => {
    const next = fraction(value);
    const denominator = sum.denominator > next.denominator ? sum.denominator : next.denominator;
    return { numerator: sum.numerator * (denominator / sum.denominator) + next.numerator * (denominator / next.denominator), denominator };
  },
  { numerator: 0n, denominator: 1n }
), decimals);
var multiplyDecimal = (values, divisor = 1, decimals = 2) => {
  const product = values.map(fraction).reduce(
    (total, value) => ({
      numerator: total.numerator * value.numerator,
      denominator: total.denominator * value.denominator
    }),
    { numerator: 1n, denominator: 1n }
  );
  const divisorFraction = fraction(divisor);
  return rounded({
    numerator: product.numerator * divisorFraction.denominator,
    denominator: product.denominator * divisorFraction.numerator
  }, decimals);
};

// src/shared/proposalFinancials.ts
var calculateProposalTotals = (materials, labor, bdiMultiplier, taxPercentage = 0) => {
  const baseCost = sumDecimal([materials, labor]);
  const subtotalWithBdi = multiplyDecimal([baseCost, bdiMultiplier]);
  const taxAmount = taxPercentage > 0 ? multiplyDecimal([subtotalWithBdi, taxPercentage], 100) : 0;
  const finalValue = sumDecimal([subtotalWithBdi, taxAmount]);
  const additions = sumDecimal([finalValue, -baseCost]);
  if (taxPercentage > 0) {
    return {
      materials,
      labor,
      baseCost,
      subtotalWithBdi,
      taxPercentage,
      taxAmount,
      finalValue,
      additions
    };
  }
  return { materials, labor, baseCost, finalValue, additions };
};
var getProposalFinancials = (proposal) => {
  const materials = proposal.totals.materials ?? sumDecimal(proposal.items.map((item) => item.totalCost));
  const labor = proposal.totals.labor ?? sumDecimal((proposal.laborItems ?? []).map((item) => item.totalCost));
  const taxPercentage = proposal.taxPercentage ?? 0;
  const calculated = calculateProposalTotals(materials, labor, proposal.bdiMultiplier, taxPercentage);
  return {
    ...calculated,
    baseCost: proposal.totals.baseCost ?? calculated.baseCost,
    finalValue: proposal.totals.finalValue ?? calculated.finalValue,
    additions: proposal.totals.additions ?? calculated.additions,
    taxPercentage,
    taxAmount: proposal.totals.taxAmount ?? calculated.taxAmount ?? 0
  };
};

// src/server/services/proposalTotalsSql.ts
var materialsCostSql = `COALESCE((
  SELECT SUM(ROUND(pi.quantity * pi.snapshot_unit_cost, 2))
  FROM proposal_items pi WHERE pi.proposal_id = p.id
), 0)`;
var laborCostSql = `COALESCE((
  SELECT SUM(ROUND(pli.professional_count
    * (pli.monthly_salary + pli.monthly_food + pli.monthly_transport + pli.monthly_other_costs)
    * pli.planned_hours / NULLIF(pli.standard_monthly_hours, 0), 2))
  FROM proposal_labor_items pli WHERE pli.proposal_id = p.id
), 0)`;
var baseCostSql = `(${materialsCostSql} + ${laborCostSql})`;
var finalValueSql = `ROUND(${baseCostSql} * p.bdi_multiplier * (1 + COALESCE(p.tax_percentage, 0) / 100), 2)`;

// src/server/services/proposalLabor.ts
var import_node_crypto3 = require("node:crypto");

// src/shared/labor.ts
var calculateLaborItem = (input) => {
  if (!Number.isFinite(input.standardMonthlyHours) || input.standardMonthlyHours <= 0) {
    throw new Error("LABOR_HOURS_INVALID");
  }
  const monthlyCost = sumDecimal([
    input.monthlySalary,
    input.monthlyFood,
    input.monthlyTransport,
    input.monthlyOtherCosts
  ]);
  return {
    monthlyCost,
    hourlyRate: multiplyDecimal([monthlyCost], input.standardMonthlyHours, 4),
    plannedHoursPerProfessional: input.plannedHours,
    plannedTeamHours: multiplyDecimal([input.professionalCount, input.plannedHours], 1, 4),
    totalCost: multiplyDecimal([input.professionalCount, monthlyCost, input.plannedHours], input.standardMonthlyHours)
  };
};

// src/server/services/proposalLabor.ts
var laborSnapshot = (input) => ({
  ...input,
  ...calculateLaborItem(input)
});
var mapLaborItem = (row) => {
  const input = {
    professionalCount: Number(row.professional_count),
    monthlySalary: Number(row.monthly_salary),
    monthlyFood: Number(row.monthly_food),
    monthlyTransport: Number(row.monthly_transport),
    monthlyOtherCosts: Number(row.monthly_other_costs),
    standardMonthlyHours: Number(row.standard_monthly_hours),
    plannedHours: Number(row.planned_hours)
  };
  return {
    id: row.id,
    description: row.description,
    ...input,
    ...calculateLaborItem(input)
  };
};
var listProposalLaborItems = async (database, proposalId) => {
  const result = await database.query(`
    SELECT id, description, professional_count::text, monthly_salary::text, monthly_food::text,
      monthly_transport::text, monthly_other_costs::text, standard_monthly_hours::text, planned_hours::text
    FROM proposal_labor_items
    WHERE proposal_id = $1
    ORDER BY position, created_at
  `, [proposalId]);
  return result.rows.map(mapLaborItem);
};
var getProposalStandardMonthlyHours = async (database, proposalId) => {
  const result = await database.query(
    "SELECT standard_monthly_hours::text FROM proposals WHERE id = $1",
    [proposalId]
  );
  return Number(result.rows[0]?.standard_monthly_hours ?? 176);
};
var assertEditable = async (database, proposalId) => {
  const result = await database.query(`
    SELECT p.status,
      EXISTS (SELECT 1 FROM proposals newer WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision) AS superseded
    FROM proposals p WHERE p.id = $1 FOR UPDATE
  `, [proposalId]);
  const proposal = result.rows[0];
  if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
  if (proposal.superseded || !["draft", "review"].includes(proposal.status)) throw new Error("PROPOSAL_LOCKED");
};
var selectLaborItemForUpdate = async (database, proposalId, itemId) => {
  const result = await database.query(`
    SELECT id, description, professional_count::text, monthly_salary::text, monthly_food::text,
      monthly_transport::text, monthly_other_costs::text, standard_monthly_hours::text, planned_hours::text
    FROM proposal_labor_items
    WHERE proposal_id = $1 AND id = $2
    FOR UPDATE
  `, [proposalId, itemId]);
  if (!result.rows[0]) throw new Error("LABOR_ITEM_NOT_FOUND");
  return mapLaborItem(result.rows[0]);
};
var createProposalLaborItem = async (database, proposalId, input, userId) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    const after = laborSnapshot(input);
    const next = await transaction.query(
      "SELECT COALESCE(max(position), 0) + 1 AS position FROM proposal_labor_items WHERE proposal_id = $1",
      [proposalId]
    );
    const itemId = (0, import_node_crypto3.randomUUID)();
    await transaction.query(`
      INSERT INTO proposal_labor_items
        (id, proposal_id, position, description, professional_count, monthly_salary, monthly_food,
         monthly_transport, monthly_other_costs, standard_monthly_hours, planned_hours)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      itemId,
      proposalId,
      next.rows[0]?.position ?? 1,
      input.description.trim(),
      input.professionalCount,
      input.monthlySalary,
      input.monthlyFood,
      input.monthlyTransport,
      input.monthlyOtherCosts,
      input.standardMonthlyHours,
      input.plannedHours
    ]);
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal_labor_item', $3, 'created', $4::jsonb)
    `, [(0, import_node_crypto3.randomUUID)(), userId, itemId, JSON.stringify({ proposalId, ...after })]);
  });
};
var updateProposalLaborItem = async (database, proposalId, itemId, input, userId) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    const after = laborSnapshot(input);
    const before = await selectLaborItemForUpdate(transaction, proposalId, itemId);
    const result = await transaction.query(`
      UPDATE proposal_labor_items
      SET description=$3, professional_count=$4, monthly_salary=$5, monthly_food=$6,
          monthly_transport=$7, monthly_other_costs=$8, standard_monthly_hours=$9,
          planned_hours=$10, updated_at=now()
      WHERE proposal_id=$1 AND id=$2
      RETURNING id
    `, [
      proposalId,
      itemId,
      input.description.trim(),
      input.professionalCount,
      input.monthlySalary,
      input.monthlyFood,
      input.monthlyTransport,
      input.monthlyOtherCosts,
      input.standardMonthlyHours,
      input.plannedHours
    ]);
    if (result.rows.length === 0) throw new Error("LABOR_ITEM_NOT_FOUND");
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, $2, 'proposal_labor_item', $3, 'updated', $4::jsonb, $5::jsonb)
    `, [(0, import_node_crypto3.randomUUID)(), userId, itemId, JSON.stringify({ proposalId, ...before }), JSON.stringify({ proposalId, ...after })]);
  });
};
var removeProposalLaborItem = async (database, proposalId, itemId, userId) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    const before = await selectLaborItemForUpdate(transaction, proposalId, itemId);
    const result = await transaction.query("DELETE FROM proposal_labor_items WHERE proposal_id=$1 AND id=$2 RETURNING id", [proposalId, itemId]);
    if (result.rows.length === 0) throw new Error("LABOR_ITEM_NOT_FOUND");
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, before_data)
      VALUES ($1, $2, 'proposal_labor_item', $3, 'removed', $4::jsonb)
    `, [(0, import_node_crypto3.randomUUID)(), userId, itemId, JSON.stringify({ proposalId, ...before })]);
  });
};
var updateProposalStandardMonthlyHours = async (database, proposalId, hours, userId) => {
  await database.transaction(async (transaction) => {
    await assertEditable(transaction, proposalId);
    const before = await transaction.query(
      "SELECT standard_monthly_hours::text FROM proposals WHERE id=$1 FOR UPDATE",
      [proposalId]
    );
    await transaction.query("UPDATE proposals SET standard_monthly_hours=$2, updated_at=now() WHERE id=$1", [proposalId, hours]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, $2, 'proposal', $3, 'labor_settings_updated', $4::jsonb, $5::jsonb)
    `, [
      (0, import_node_crypto3.randomUUID)(),
      userId,
      proposalId,
      JSON.stringify({ standardMonthlyHours: Number(before.rows[0]?.standard_monthly_hours ?? 176) }),
      JSON.stringify({ standardMonthlyHours: hours })
    ]);
  });
};
var copyProposalLabor = async (database, sourceProposalId, targetProposalId) => {
  const items = await listProposalLaborItems(database, sourceProposalId);
  const hours = await getProposalStandardMonthlyHours(database, sourceProposalId);
  await database.query("UPDATE proposals SET standard_monthly_hours=$2 WHERE id=$1", [targetProposalId, hours]);
  for (const [index, item] of items.entries()) {
    await database.query(`
      INSERT INTO proposal_labor_items
        (id, proposal_id, position, description, professional_count, monthly_salary, monthly_food,
         monthly_transport, monthly_other_costs, standard_monthly_hours, planned_hours)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      (0, import_node_crypto3.randomUUID)(),
      targetProposalId,
      index + 1,
      item.description,
      item.professionalCount,
      item.monthlySalary,
      item.monthlyFood,
      item.monthlyTransport,
      item.monthlyOtherCosts,
      item.standardMonthlyHours,
      item.plannedHours
    ]);
  }
};

// src/server/services/proposalCommon.ts
var roundMoney = (value) => roundDecimal(value);
var getLatestProposal = async (database, proposalId) => {
  const result = await database.query(`
    SELECT p.status, p.bdi_multiplier::text, p.proposal_number, p.revision,
      COALESCE(p.tax_percentage, 0)::text AS tax_percentage,
      EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS superseded
    FROM proposals p
    WHERE p.id = $1
    FOR UPDATE
  `, [proposalId]);
  const proposal = result.rows[0];
  if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
  if (proposal.superseded) throw new Error("PROPOSAL_LOCKED");
  return proposal;
};
var getEditableProposal = async (database, proposalId) => {
  const proposal = await getLatestProposal(database, proposalId);
  if (proposal.status !== "draft" && proposal.status !== "review") throw new Error("PROPOSAL_LOCKED");
  return proposal;
};

// src/server/services/proposalLifecycle.ts
var import_node_crypto6 = require("node:crypto");

// src/shared/proposalStatus.ts
var proposalStatusTransitions = {
  draft: ["review", "sent", "approved", "rejected"],
  review: ["draft", "sent", "approved", "rejected"],
  sent: ["draft", "review", "approved", "rejected"],
  approved: [],
  rejected: ["draft", "review", "sent", "approved"]
};
var canChangeProposalStatus = (current, next) => current === next || proposalStatusTransitions[current].includes(next);

// src/server/services/logger.ts
var SENSITIVE_KEYS = /* @__PURE__ */ new Set(["bdi", "bdiMultiplier", "salary", "cost", "margin", "unitCost", "snapshot_unit_cost", "monthly_salary"]);
var sanitize = (context) => {
  const out = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
};
var logEvent = (level, event, context = {}) => {
  const payload = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    event,
    ...sanitize(context)
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

// src/server/services/integration/proposalSealing.ts
var import_node_crypto5 = require("node:crypto");

// src/server/services/settings.ts
var import_node_crypto4 = require("node:crypto");
var defaultSettings = {
  companyName: "LAC CONSTRUTEC CONSTRUTORA EIRELI",
  tradeName: "CONSTRUTEC",
  document: "32.992.946/0001-78",
  phone: "(71) 99294-1099",
  email: "supervisao@rcconstrutec.com.br / engenharia@rcconstrutec.com.br",
  address: "Rua Metodio Coelho, 62, EDIFICIO CIDADELLA CENTER  I, Sala 112/ PARQUE BELA VISTA/ Salvador BA /40050-450",
  defaultResponsible: "Marcos Ribeiro",
  defaultBdi: 1.45,
  defaultStandardHours: 176,
  defaultValidityDays: 15,
  defaultTaxPercentage: 0,
  pdfShowLogo: true,
  pdfShowSignature: true
};
var ensureSettingsStorage = async (database) => {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};
var getAppSettings = async (database) => {
  await ensureSettingsStorage(database);
  const result = await database.query(
    "SELECT value FROM app_settings WHERE key = 'general'"
  );
  if (result.rows[0]?.value) {
    const val = result.rows[0].value;
    const isOldPlaceholder = !val.address || val.address === "S\xE3o Paulo - SP" || !val.phone || val.companyName === "Construtec Engenharia Ltda." || val.email === "comercial@construtec.local" || val.email === "comercial@construtecengenharia.com.br";
    const resolved = {
      companyName: isOldPlaceholder && (val.companyName === "Construtec Engenharia Ltda." || !val.companyName) ? defaultSettings.companyName : val.companyName?.trim() || defaultSettings.companyName,
      tradeName: val.tradeName?.trim() || defaultSettings.tradeName,
      document: val.document?.trim() || defaultSettings.document,
      phone: !val.phone || isOldPlaceholder ? defaultSettings.phone : val.phone,
      email: !val.email || isOldPlaceholder ? defaultSettings.email : val.email,
      address: !val.address || val.address === "S\xE3o Paulo - SP" || isOldPlaceholder ? defaultSettings.address : val.address,
      defaultResponsible: val.defaultResponsible?.trim() || defaultSettings.defaultResponsible,
      defaultBdi: typeof val.defaultBdi === "number" && val.defaultBdi > 0 ? val.defaultBdi : defaultSettings.defaultBdi,
      defaultStandardHours: typeof val.defaultStandardHours === "number" && val.defaultStandardHours > 0 ? val.defaultStandardHours : defaultSettings.defaultStandardHours,
      defaultValidityDays: typeof val.defaultValidityDays === "number" && val.defaultValidityDays > 0 ? val.defaultValidityDays : defaultSettings.defaultValidityDays,
      defaultTaxPercentage: typeof val.defaultTaxPercentage === "number" && val.defaultTaxPercentage >= 0 && val.defaultTaxPercentage <= 100 ? val.defaultTaxPercentage : defaultSettings.defaultTaxPercentage,
      pdfShowLogo: typeof val.pdfShowLogo === "boolean" ? val.pdfShowLogo : defaultSettings.pdfShowLogo,
      pdfShowSignature: typeof val.pdfShowSignature === "boolean" ? val.pdfShowSignature : defaultSettings.pdfShowSignature
    };
    if (isOldPlaceholder) {
      await database.query("UPDATE app_settings SET value = $1 WHERE key = 'general'", [JSON.stringify(resolved)]);
    }
    return resolved;
  }
  await database.query(
    "INSERT INTO app_settings (key, value) VALUES ('general', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify(defaultSettings)]
  );
  return defaultSettings;
};
var updateAppSettings = async (database, input) => {
  const current = await getAppSettings(database);
  const updated = {
    ...current,
    ...input,
    defaultBdi: typeof input.defaultBdi === "number" && input.defaultBdi > 0 ? input.defaultBdi : current.defaultBdi,
    defaultStandardHours: typeof input.defaultStandardHours === "number" && input.defaultStandardHours > 0 ? input.defaultStandardHours : current.defaultStandardHours,
    defaultValidityDays: typeof input.defaultValidityDays === "number" && input.defaultValidityDays > 0 ? input.defaultValidityDays : current.defaultValidityDays,
    defaultTaxPercentage: typeof input.defaultTaxPercentage === "number" && input.defaultTaxPercentage >= 0 && input.defaultTaxPercentage <= 100 ? input.defaultTaxPercentage : current.defaultTaxPercentage,
    pdfShowLogo: typeof input.pdfShowLogo === "boolean" ? input.pdfShowLogo : current.pdfShowLogo,
    pdfShowSignature: typeof input.pdfShowSignature === "boolean" ? input.pdfShowSignature : current.pdfShowSignature
  };
  await database.query(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('general', $1, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now()
  `, [JSON.stringify(updated)]);
  if (typeof input.defaultBdi === "number" && input.defaultBdi > 0) {
    await database.query(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('default_bdi_confirmed', 'true'::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()
    `);
  }
  return updated;
};
var getNewProposalDefaults = async (database) => {
  const settings = await getAppSettings(database);
  const confirmed = await database.query("SELECT value FROM app_settings WHERE key = 'default_bdi_confirmed'");
  return { bdiMultiplier: confirmed.rows[0]?.value === true ? settings.defaultBdi : 1.25, taxPercentage: settings.defaultTaxPercentage };
};
var getIntegrationIdentity = async (database) => {
  await ensureSettingsStorage(database);
  const result = await database.query(
    "SELECT value FROM app_settings WHERE key = 'integration_identity'"
  );
  if (result.rows[0]?.value) {
    return result.rows[0].value;
  }
  const identity = {
    namespaceId: (0, import_node_crypto4.randomUUID)(),
    installationId: (0, import_node_crypto4.randomUUID)()
  };
  await database.query(
    "INSERT INTO app_settings (key, value) VALUES ('integration_identity', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify(identity)]
  );
  return identity;
};

// src/server/services/integration/proposalSealing.ts
function canonicalJsonStringify(object) {
  if (object === null || typeof object !== "object") {
    return JSON.stringify(object);
  }
  if (Array.isArray(object)) {
    return "[" + object.map((item) => canonicalJsonStringify(item)).join(",") + "]";
  }
  const keys = Object.keys(object).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(object[key])}`);
  return "{" + pairs.join(",") + "}";
}
function computeSha256(content) {
  return (0, import_node_crypto5.createHash)("sha256").update(content, "utf8").digest("hex");
}
var buildApprovedProposalEnvelope = async (database, proposalId, userId, evidence) => {
  const proposalResult = await database.query(`
    SELECT p.id, p.series_id, p.proposal_number, p.revision, p.client_id, p.work_id,
      p.work_name, p.scope, p.status, p.bdi_multiplier::text, p.tax_percentage::text,
      p.valid_until::text, p.updated_at::text, c.legal_name AS client_legal_name,
      c.trade_name AS client_trade_name, c.document AS client_document,
      w.address AS work_address, u.name AS creator_name
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    LEFT JOIN works w ON w.id = p.work_id
    WHERE p.id = $1
  `, [proposalId]);
  const p = proposalResult.rows[0];
  if (!p) throw new Error("PROPOSAL_NOT_FOUND");
  const identity = await getIntegrationIdentity(database);
  const bdiMultiplier = Number(p.bdi_multiplier);
  const taxPercentage = Number(p.tax_percentage || 0);
  const itemsResult = await database.query(`
    SELECT id, position, snapshot_code, snapshot_description, snapshot_category,
      snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
    FROM proposal_items
    WHERE proposal_id = $1
    ORDER BY position ASC
  `, [proposalId]);
  const materials = itemsResult.rows.map((item, idx) => {
    const qtyNum = Number(item.quantity);
    const costNum = Number(item.snapshot_unit_cost);
    const totalCostNum = roundMoney(qtyNum * costNum);
    const allocatedSaleNum = roundMoney(totalCostNum * bdiMultiplier);
    return {
      id: item.id,
      position: idx + 1,
      code: item.snapshot_code,
      description: item.snapshot_description,
      category: item.snapshot_category || "Geral",
      unit: item.snapshot_unit,
      quantity: qtyNum.toFixed(4),
      unitCost: costNum.toFixed(4),
      totalCost: totalCostNum.toFixed(2),
      sourceUnitSale: Number(item.sale_unit_price).toFixed(2),
      sourceTotalSale: roundMoney(qtyNum * Number(item.sale_unit_price)).toFixed(2),
      allocatedSale: allocatedSaleNum.toFixed(2)
    };
  });
  const laborResult = await database.query(`
    SELECT id, position, description, professional_count::text, planned_hours::text,
      monthly_salary::text, monthly_food::text, monthly_transport::text,
      monthly_other_costs::text, standard_monthly_hours::text
    FROM proposal_labor_items
    WHERE proposal_id = $1
    ORDER BY position ASC
  `, [proposalId]);
  const labor = laborResult.rows.map((l, idx) => {
    const countNum = Number(l.professional_count);
    const plannedHoursNum = Number(l.planned_hours);
    const salary = Number(l.monthly_salary || 0);
    const food = Number(l.monthly_food || 0);
    const transport = Number(l.monthly_transport || 0);
    const other = Number(l.monthly_other_costs || 0);
    const monthlyTotal = salary + food + transport + other;
    const stdHours = Number(l.standard_monthly_hours || 176);
    const teamHoursNum = countNum * plannedHoursNum;
    const totalCostNum = roundMoney(countNum * monthlyTotal * (plannedHoursNum / stdHours));
    const allocatedSaleNum = roundMoney(totalCostNum * bdiMultiplier);
    return {
      id: l.id,
      position: idx + 1,
      roleName: l.description,
      costBasis: "composition",
      professionalCount: countNum.toFixed(2),
      plannedHoursPerProfessional: plannedHoursNum.toFixed(2),
      plannedTeamHours: teamHoursNum.toFixed(4),
      monthlySalary: salary.toFixed(2),
      monthlyFood: food.toFixed(2),
      monthlyTransport: transport.toFixed(2),
      monthlyOtherCosts: other.toFixed(2),
      standardMonthlyHours: stdHours.toFixed(2),
      hourlyRate: (monthlyTotal / stdHours).toFixed(4),
      totalCost: totalCostNum.toFixed(2),
      allocatedSale: allocatedSaleNum.toFixed(2)
    };
  });
  const materialsCost = roundMoney(materials.reduce((sum, m) => sum + Number(m.totalCost), 0));
  const laborCost = roundMoney(labor.reduce((sum, l) => sum + Number(l.totalCost), 0));
  const baseCost = roundMoney(materialsCost + laborCost);
  const contractValueBeforeTax = roundMoney(baseCost * bdiMultiplier);
  const taxAmount = roundMoney(contractValueBeforeTax * (taxPercentage / 100));
  const contractValue = roundMoney(contractValueBeforeTax + taxAmount);
  const additions = roundMoney(contractValueBeforeTax - baseCost);
  const totalAllocated = roundMoney(
    materials.reduce((sum, m) => sum + Number(m.allocatedSale), 0) + labor.reduce((sum, l) => sum + Number(l.allocatedSale), 0)
  );
  const salesRoundingAdjustment = roundMoney(contractValue - totalAllocated);
  let baseRevision = null;
  let basePayloadSha256 = null;
  if (p.revision > 0) {
    baseRevision = p.revision - 1;
    const prevSnapshot = await database.query(`
      SELECT s.payload_sha256
      FROM proposal_approval_snapshots s
      JOIN proposals pr ON pr.id = s.proposal_id
      WHERE pr.proposal_number = $1 AND pr.revision = $2
    `, [p.proposal_number, baseRevision]);
    basePayloadSha256 = prevSnapshot.rows[0]?.payload_sha256 ?? null;
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const payload = {
    source: {
      system: "construtec-orcamentos",
      namespaceId: identity.namespaceId,
      installationId: identity.installationId,
      version: "1.0.5"
    },
    proposal: {
      id: p.id,
      seriesId: p.series_id,
      number: p.proposal_number,
      revision: p.revision,
      status: "approved",
      approval: {
        approvedAt: nowIso,
        recordedAt: nowIso,
        recordedBy: p.creator_name,
        evidenceKind: evidence?.evidenceKind || "client_acceptance",
        evidenceReference: evidence?.evidenceReference || `ACEITE-${p.proposal_number}`
      },
      validUntil: p.valid_until ? p.valid_until.slice(0, 10) : null,
      responsibleName: p.creator_name,
      change: {
        kind: p.revision === 0 ? "initial" : "replacement",
        baseRevision,
        basePayloadSha256
      }
    },
    client: {
      sourceId: p.client_id,
      legalName: p.client_legal_name,
      tradeName: p.client_trade_name || null,
      document: p.client_document || null,
      contacts: []
    },
    work: {
      sourceId: p.work_id || `work-${p.id}`,
      name: p.work_name,
      address: p.work_address || null,
      scope: p.scope
    },
    pricing: {
      currency: "BRL",
      calculationVersion: "construtec-decimal-v1",
      method: "bdi_multiplier",
      bdiMultiplier: bdiMultiplier.toFixed(4),
      taxPercentage: taxPercentage.toFixed(2)
    },
    materials,
    labor,
    totals: {
      materialsCost: materialsCost.toFixed(2),
      laborCost: laborCost.toFixed(2),
      baseCost: baseCost.toFixed(2),
      contractValueBeforeTax: contractValueBeforeTax.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      contractValue: contractValue.toFixed(2),
      additions: additions.toFixed(2),
      salesRoundingAdjustment: salesRoundingAdjustment.toFixed(2)
    }
  };
  const canonical = canonicalJsonStringify(payload);
  const payloadSha256 = computeSha256(canonical);
  const envelope = {
    schemaVersion: "1.0.0",
    eventId: (0, import_node_crypto5.randomUUID)(),
    emittedAt: nowIso,
    payloadSha256,
    payload
  };
  return envelope;
};
var sealProposalInTransaction = async (transaction, proposalId, userId, evidence) => {
  const tableCheck = await transaction.query(
    "SELECT to_regclass('proposal_approval_snapshots') IS NOT NULL AS exists"
  );
  if (!tableCheck.rows[0]?.exists) {
    return null;
  }
  const existing = await transaction.query(
    "SELECT id, payload_sha256 FROM proposal_approval_snapshots WHERE proposal_id = $1",
    [proposalId]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }
  const envelope = await buildApprovedProposalEnvelope(transaction, proposalId, userId, evidence);
  const snapshotId = (0, import_node_crypto5.randomUUID)();
  await transaction.query(`
    INSERT INTO proposal_approval_snapshots
      (id, proposal_id, series_id, revision, payload, payload_sha256, sealed_at, sealed_by)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
  `, [
    snapshotId,
    proposalId,
    envelope.payload.proposal.seriesId,
    envelope.payload.proposal.revision,
    JSON.stringify(envelope.payload),
    envelope.payloadSha256,
    envelope.emittedAt,
    userId ?? null
  ]);
  await transaction.query(`
    INSERT INTO integration_outbox
      (id, snapshot_id, destination, status, attempts, created_at)
    VALUES ($1, $2, 'centro-de-custos', 'pending', 0, $3)
  `, [(0, import_node_crypto5.randomUUID)(), snapshotId, envelope.emittedAt]);
  return { id: snapshotId, payloadSha256: envelope.payloadSha256, envelope };
};

// src/server/services/proposalLifecycle.ts
var createRevision = async (database, sourceProposalId, userId) => {
  return database.transaction(async (transaction) => {
    const source = await getLatestProposal(transaction, sourceProposalId);
    const newProposalId = (0, import_node_crypto6.randomUUID)();
    const created = await transaction.query(`
      INSERT INTO proposals
        (id, series_id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, tax_percentage, valid_until, created_by)
      SELECT $2, series_id, proposal_number, revision + 1, client_id, work_id, work_name, snapshot_client_name,
        snapshot_work_name, scope, 'draft', bdi_multiplier, COALESCE(tax_percentage, 0), valid_until, created_by
      FROM proposals
      WHERE id = $1
      RETURNING revision
    `, [sourceProposalId, newProposalId]);
    const items = await transaction.query(`
      SELECT catalog_product_id, position, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
      ORDER BY position
    `, [sourceProposalId]);
    for (const item of items.rows) {
      await transaction.query(`
        INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
           snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        (0, import_node_crypto6.randomUUID)(),
        newProposalId,
        item.catalog_product_id,
        item.position,
        item.snapshot_code,
        item.snapshot_manufacturer,
        item.snapshot_model,
        item.snapshot_description,
        item.snapshot_category ?? "Outros",
        item.snapshot_unit,
        Number(item.snapshot_unit_cost),
        Number(item.quantity),
        Number(item.sale_unit_price)
      ]);
    }
    await copyProposalLabor(transaction, sourceProposalId, newProposalId);
    if (userId) await transaction.query("UPDATE proposals SET created_by = $2 WHERE id = $1", [newProposalId, userId]);
    const revision = created.rows[0]?.revision ?? source.revision + 1;
    await transaction.query(
      "INSERT INTO audit_events (id, entity_type, entity_id, action, after_data, user_id) VALUES ($1, $2, $3, $4, $5::jsonb, $6)",
      [(0, import_node_crypto6.randomUUID)(), "proposal", newProposalId, "revision_created", JSON.stringify({ sourceProposalId, proposalNumber: source.proposal_number, revision }), userId ?? null]
    );
    logEvent("info", "proposal.revision_created", { sourceProposalId, newProposalId, revision });
    return newProposalId;
  });
};
var updateProposalContext = async (database, proposalId, clientId, workId) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const current = await transaction.query("SELECT client_id, work_id, snapshot_client_name, snapshot_work_name FROM proposals WHERE id = $1", [proposalId]);
    const workResult = await transaction.query(`
      SELECT w.name AS work_name, COALESCE(c.trade_name, c.legal_name) AS client_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [workId, clientId]);
    const context = workResult.rows[0];
    if (!context) throw new Error("WORK_NOT_FOUND");
    await transaction.query(`
      UPDATE proposals
      SET client_id = $2, work_id = $3, work_name = $4,
          snapshot_client_name = $5, snapshot_work_name = $4, updated_at = now()
      WHERE id = $1
    `, [proposalId, clientId, workId, context.work_name, context.client_name]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'context_updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto6.randomUUID)(), proposalId, JSON.stringify(current.rows[0] ?? null), JSON.stringify({ clientId, workId, clientName: context.client_name, workName: context.work_name })]);
    logEvent("info", "proposal.context_updated", { proposalId });
  });
};
var listProposalHistory = async (database, proposalId) => {
  const result = await database.query(`
    SELECT p.id, p.proposal_number, p.revision, p.status,
      count(i.id)::text AS item_count,
      ${finalValueSql}::text AS total_sale,
      u.name AS responsible_name, p.updated_at::text,
      p.revision = max(p.revision) OVER (PARTITION BY p.proposal_number) AS is_latest
    FROM proposals p
    JOIN proposals selected ON selected.id = $1 AND selected.proposal_number = p.proposal_number
    JOIN users u ON u.id = p.created_by
    LEFT JOIN proposal_items i ON i.proposal_id = p.id
    GROUP BY p.id, u.name, p.bdi_multiplier
    ORDER BY p.revision DESC
  `, [proposalId]);
  return result.rows.map((revision) => ({
    id: revision.id,
    number: revision.proposal_number,
    revision: revision.revision,
    status: revision.status,
    itemCount: Number(revision.item_count),
    totalSale: roundMoney(Number(revision.total_sale)),
    responsibleName: revision.responsible_name,
    updatedAt: revision.updated_at,
    isLatest: revision.is_latest
  }));
};
var deleteProposal = async (database, proposalId, mode = "all") => {
  let nextProposalId;
  await database.transaction(async (transaction) => {
    const current = await transaction.query(
      "SELECT proposal_number, revision FROM proposals WHERE id = $1",
      [proposalId]
    );
    const row = current.rows[0];
    if (!row) throw new Error("PROPOSAL_NOT_FOUND");
    const candidates = await transaction.query(
      "SELECT status FROM proposals WHERE proposal_number = $1 AND ($2::text = 'all' OR id = $3) ORDER BY revision FOR UPDATE",
      [row.proposal_number, mode, proposalId]
    );
    if (candidates.rows.some((candidate) => candidate.status === "approved")) throw new Error("PROPOSAL_LOCKED");
    if (mode === "all") {
      await transaction.query("DELETE FROM proposals WHERE proposal_number = $1", [row.proposal_number]);
      logEvent("info", "proposal.deleted_all", { proposalNumber: row.proposal_number });
    } else {
      await transaction.query("DELETE FROM proposals WHERE id = $1", [proposalId]);
      logEvent("info", "proposal.deleted_revision", { proposalId, proposalNumber: row.proposal_number, revision: row.revision });
    }
    const remaining = await transaction.query(`
      SELECT id FROM proposals
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    nextProposalId = remaining.rows[0]?.id;
  });
  return { nextProposalId };
};
var updateProposalStatusWithGetter = async (database, proposalId, status, getById, userId) => {
  await database.transaction(async (transaction) => {
    const row = await getLatestProposal(transaction, proposalId);
    if (!canChangeProposalStatus(row.status, status)) throw new Error("PROPOSAL_LOCKED");
    if (row.status === status) return;
    await transaction.query("UPDATE proposals SET status = $2, updated_at = now() WHERE id = $1", [proposalId, status]);
    if (status === "approved") {
      await sealProposalInTransaction(transaction, proposalId, userId);
    }
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'status_updated', $3::jsonb, $4::jsonb, $5)
    `, [(0, import_node_crypto6.randomUUID)(), proposalId, JSON.stringify({ status: row.status }), JSON.stringify({ status }), userId ?? null]);
    logEvent("info", "proposal.status_updated", { proposalId, status });
  });
  const updated = await getById(database, proposalId);
  if (!updated) throw new Error("PROPOSAL_NOT_FOUND");
  return updated;
};
var cloneProposal = async (database, sourceProposalId, input, actorId) => {
  return database.transaction(async (transaction) => {
    const userResult = await transaction.query("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
    const userId = actorId ?? userResult.rows[0]?.id;
    if (!userId) throw new Error("NO_USER_FOUND");
    const sourceResult = await transaction.query(`
      SELECT p.client_id, p.work_id, p.work_name, p.snapshot_client_name,
        p.snapshot_work_name, p.scope, p.bdi_multiplier::text, COALESCE(p.tax_percentage, 0)::text AS tax_percentage, p.proposal_number
      FROM proposals p
      WHERE p.id = $1 FOR UPDATE
    `, [sourceProposalId]);
    const source = sourceResult.rows[0];
    if (!source) throw new Error("PROPOSAL_NOT_FOUND");
    const targetClientId = input?.clientId || source.client_id;
    const targetWorkId = input?.workId || source.work_id;
    const workResult = await transaction.query(`
      SELECT c.trade_name AS client_name, w.name AS work_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [targetWorkId, targetClientId]);
    const targetContext = workResult.rows[0];
    if (!targetContext) throw new Error("WORK_NOT_FOUND");
    const numberResult = await transaction.query(`
      SELECT proposal_number
      FROM proposals
      WHERE proposal_number ~ '^PA-[0-9]+$'
      ORDER BY substring(proposal_number from 4)::integer DESC
      LIMIT 1
    `);
    const currentNumber = Number(numberResult.rows[0]?.proposal_number.slice(3) ?? 1e3);
    const newProposalNumber = `PA-${String(currentNumber + 1).padStart(4, "0")}`;
    const newProposalId = (0, import_node_crypto6.randomUUID)();
    await transaction.query(`
      INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, tax_percentage, created_by)
      VALUES ($1, $2, 0, $3, $4, $5, $6, $5, $7, 'draft', $8, $9, $10)
    `, [
      newProposalId,
      newProposalNumber,
      targetClientId,
      targetWorkId,
      targetContext.work_name,
      targetContext.client_name,
      input?.scope?.trim() || source.scope,
      Number(source.bdi_multiplier),
      Number(source.tax_percentage),
      userId
    ]);
    const items = await transaction.query(`
      SELECT catalog_product_id, position, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
      ORDER BY position
    `, [sourceProposalId]);
    for (const item of items.rows) {
      await transaction.query(`
        INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
           snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        (0, import_node_crypto6.randomUUID)(),
        newProposalId,
        item.catalog_product_id,
        item.position,
        item.snapshot_code,
        item.snapshot_manufacturer,
        item.snapshot_model,
        item.snapshot_description,
        item.snapshot_category ?? "Outros",
        item.snapshot_unit,
        Number(item.snapshot_unit_cost),
        Number(item.quantity),
        Number(item.sale_unit_price)
      ]);
    }
    await copyProposalLabor(transaction, sourceProposalId, newProposalId);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'cloned', $3::jsonb, $4)
    `, [(0, import_node_crypto6.randomUUID)(), newProposalId, JSON.stringify({ sourceProposalId, newProposalNumber }), userId]);
    logEvent("info", "proposal.cloned", { sourceProposalId, newProposalId, newProposalNumber });
    return newProposalId;
  });
};

// src/server/services/proposalMutations.ts
var import_node_crypto7 = require("node:crypto");
var createProposal = async (database, input) => {
  return database.transaction(async (transaction) => {
    const userResult = await transaction.query("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("NO_USER_FOUND");
    const workResult = await transaction.query(`
      SELECT w.name AS work_name, COALESCE(c.trade_name, c.legal_name) AS client_name
      FROM works w
      JOIN clients c ON c.id = w.client_id
      WHERE w.id = $1 AND w.client_id = $2 AND w.active = true
    `, [input.workId, input.clientId]);
    const context = workResult.rows[0];
    if (!context) throw new Error("WORK_NOT_FOUND");
    const numberResult = await transaction.query(`
      SELECT proposal_number
      FROM proposals
      WHERE proposal_number ~ '^PA-[0-9]+$'
      ORDER BY substring(proposal_number from 4)::integer DESC
      LIMIT 1
    `);
    const currentNumber = Number(numberResult.rows[0]?.proposal_number.slice(3) ?? 1e3);
    const proposalNumber = `PA-${String(currentNumber + 1).padStart(4, "0")}`;
    const proposalId = (0, import_node_crypto7.randomUUID)();
    const defaults = await getNewProposalDefaults(transaction);
    await transaction.query(`
      INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by, tax_percentage)
      VALUES ($1, $2, 0, $3, $4, $5, $6, $5, $7, 'draft', $8, $9, $10, $11)
    `, [
      proposalId,
      proposalNumber,
      input.clientId,
      input.workId,
      context.work_name,
      context.client_name,
      input.scope.trim(),
      input.bdiMultiplier ?? defaults.bdiMultiplier,
      input.validUntil ?? null,
      userId,
      defaults.taxPercentage
    ]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal', $3, 'created', $4::jsonb)
    `, [(0, import_node_crypto7.randomUUID)(), userId, proposalId, JSON.stringify({ proposalNumber, revision: 0, ...input })]);
    logEvent("info", "proposal.created", { proposalId, proposalNumber });
    return proposalId;
  });
};
var updateProposalBdi = async (database, proposalId, bdiMultiplier) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    await transaction.query(
      "UPDATE proposals SET bdi_multiplier = $2, updated_at = now() WHERE id = $1",
      [proposalId, bdiMultiplier]
    );
    await transaction.query(
      `UPDATE proposal_items
       SET sale_unit_price = round(snapshot_unit_cost * $2, 2)
       WHERE proposal_id = $1`,
      [proposalId, bdiMultiplier]
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'bdi_updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto7.randomUUID)(), proposalId, JSON.stringify({ bdiMultiplier: Number(proposal.bdi_multiplier) }), JSON.stringify({ bdiMultiplier })]);
    logEvent("info", "proposal.bdi_updated", { proposalId });
  });
};
var updateProposalTax = async (database, proposalId, taxPercentage) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    await transaction.query("UPDATE proposals SET tax_percentage = $2, updated_at = now() WHERE id = $1", [proposalId, taxPercentage]);
    await transaction.query(
      `INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
       VALUES ($1, 'proposal', $2, 'tax_updated', $3::jsonb, $4::jsonb)`,
      [(0, import_node_crypto7.randomUUID)(), proposalId, JSON.stringify({ taxPercentage: Number(proposal.tax_percentage ?? 0) }), JSON.stringify({ taxPercentage })]
    );
    logEvent("info", "proposal.tax_updated", { proposalId, taxPercentage });
  });
};
var updateProposalDetails = async (database, proposalId, input) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const current = await transaction.query(
      "SELECT scope, valid_until::text FROM proposals WHERE id = $1 FOR UPDATE",
      [proposalId]
    );
    const before = current.rows[0];
    if (!before) throw new Error("PROPOSAL_NOT_FOUND");
    const hasValidUntil = Object.prototype.hasOwnProperty.call(input, "validUntil");
    const next = {
      scope: input.scope?.trim() ?? before.scope,
      validUntil: hasValidUntil ? input.validUntil ?? null : before.valid_until
    };
    await transaction.query(
      "UPDATE proposals SET scope = $2, valid_until = $3, updated_at = now() WHERE id = $1",
      [proposalId, next.scope, next.validUntil]
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal', $2, 'details_updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto7.randomUUID)(), proposalId, JSON.stringify(before), JSON.stringify(next)]);
    logEvent("info", "proposal.details_updated", { proposalId });
  });
};

// src/server/services/proposalItems.ts
var import_node_crypto8 = require("node:crypto");
var searchCatalog = async (database, query, limit) => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query(`
    SELECT id, code, manufacturer, model, description, category, unit, current_cost::text, source, active, updated_at::text
    FROM products
    WHERE active = true AND ($1 = '%%' OR code ILIKE $1 OR description ILIKE $1 OR manufacturer ILIKE $1 OR model ILIKE $1)
    ORDER BY CASE WHEN code ILIKE $1 THEN 0 ELSE 1 END, description
    LIMIT $2
  `, [pattern, limit]);
  return result.rows.map((product) => ({
    id: product.id,
    code: product.code,
    manufacturer: product.manufacturer,
    model: product.model,
    description: product.description,
    category: product.category,
    unit: product.unit,
    currentCost: Number(product.current_cost),
    source: product.source,
    active: product.active,
    updatedAt: product.updated_at
  }));
};
var addProductToProposal = async (database, proposalId, productId, quantity2) => {
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    const productResult = await transaction.query("SELECT id, code, manufacturer, model, description, category, unit, current_cost::text FROM products WHERE id = $1", [productId]);
    const product = productResult.rows[0];
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const positionResult = await transaction.query(
      "SELECT COALESCE(max(position), 0) + 1 AS next_position FROM proposal_items WHERE proposal_id = $1",
      [proposalId]
    );
    const unitCost = Number(product.current_cost);
    const salePrice = roundMoney(unitCost * Number(proposal.bdi_multiplier));
    const itemId = (0, import_node_crypto8.randomUUID)();
    await transaction.query(`
      INSERT INTO proposal_items
        (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
         snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      itemId,
      proposalId,
      product.id,
      positionResult.rows[0]?.next_position ?? 1,
      product.code,
      product.manufacturer,
      product.model,
      product.description,
      product.category,
      product.unit,
      unitCost,
      quantity2,
      salePrice
    ]);
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'proposal_item', $2, 'created', $3::jsonb)
    `, [(0, import_node_crypto8.randomUUID)(), itemId, JSON.stringify({ productId, snapshotUnitCost: unitCost, quantity: quantity2, salePrice })]);
    logEvent("info", "proposal.item_added", { proposalId, itemId, quantity: quantity2 });
  });
};
var removeProposalItems = async (database, proposalId, itemIds) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const result = await transaction.query(
      "DELETE FROM proposal_items WHERE proposal_id = $1 AND id = ANY($2::uuid[]) RETURNING id",
      [proposalId, itemIds]
    );
    if (result.rows.length !== itemIds.length) throw new Error("ITEM_NOT_FOUND");
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data)
      VALUES ($1, 'proposal', $2, 'items_removed', $3::jsonb)
    `, [(0, import_node_crypto8.randomUUID)(), proposalId, JSON.stringify({ itemIds })]);
    logEvent("info", "proposal.items_removed", { proposalId, count: itemIds.length });
  });
};
var updateProposalItem = async (database, proposalId, itemId, input) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const itemResult = await transaction.query(`
      SELECT id, snapshot_code, snapshot_description, snapshot_category, quantity::text,
        snapshot_unit, snapshot_unit_cost::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1 AND id = $2
      FOR UPDATE
    `, [proposalId, itemId]);
    const item = itemResult.rows[0];
    if (!item) throw new Error("ITEM_NOT_FOUND");
    const next = {
      description: input.description?.trim() ?? item.snapshot_description,
      category: input.category?.trim() ?? item.snapshot_category ?? "Outros",
      quantity: input.quantity ?? Number(item.quantity),
      unit: input.unit?.trim() ?? item.snapshot_unit,
      unitCost: input.unitCost ?? Number(item.snapshot_unit_cost),
      unitSale: input.unitSale ?? Number(item.sale_unit_price)
    };
    await transaction.query(`
      UPDATE proposal_items
      SET snapshot_description = $3, snapshot_category = $4, quantity = $5, snapshot_unit = $6,
        snapshot_unit_cost = $7, sale_unit_price = $8
      WHERE proposal_id = $1 AND id = $2
    `, [proposalId, itemId, next.description, next.category, next.quantity, next.unit, next.unitCost, next.unitSale]);
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto8.randomUUID)(), itemId, JSON.stringify({
      description: item.snapshot_description,
      category: item.snapshot_category ?? "Outros",
      quantity: Number(item.quantity),
      unit: item.snapshot_unit,
      unitCost: Number(item.snapshot_unit_cost),
      unitSale: Number(item.sale_unit_price)
    }), JSON.stringify(next)]);
    logEvent("info", "proposal.item_updated", { proposalId, itemId });
  });
};
var duplicateProposalItem = async (database, proposalId, itemId) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const itemResult = await transaction.query(`
      SELECT catalog_product_id, snapshot_code, snapshot_manufacturer, snapshot_model,
        snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1 AND id = $2
      FOR UPDATE
    `, [proposalId, itemId]);
    const item = itemResult.rows[0];
    if (!item) throw new Error("ITEM_NOT_FOUND");
    const positionResult = await transaction.query(
      "SELECT COALESCE(max(position), 0) + 1 AS next_position FROM proposal_items WHERE proposal_id = $1",
      [proposalId]
    );
    const newItemId = (0, import_node_crypto8.randomUUID)();
    await transaction.query(`
      INSERT INTO proposal_items
        (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_manufacturer,
         snapshot_model, snapshot_description, snapshot_category, snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      newItemId,
      proposalId,
      item.catalog_product_id,
      positionResult.rows[0]?.next_position ?? 1,
      item.snapshot_code,
      item.snapshot_manufacturer,
      item.snapshot_model,
      item.snapshot_description,
      item.snapshot_category ?? "Outros",
      item.snapshot_unit,
      Number(item.snapshot_unit_cost),
      Number(item.quantity),
      Number(item.sale_unit_price)
    ]);
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'duplicated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto8.randomUUID)(), newItemId, JSON.stringify({ sourceItemId: itemId }), JSON.stringify({ position: positionResult.rows[0]?.next_position ?? 1 })]);
    logEvent("info", "proposal.item_duplicated", { proposalId, sourceItemId: itemId, newItemId });
  });
};
var moveProposalItem = async (database, proposalId, itemId, direction) => {
  await database.transaction(async (transaction) => {
    await getEditableProposal(transaction, proposalId);
    const itemResult = await transaction.query(
      "SELECT id, position FROM proposal_items WHERE proposal_id = $1 AND id = $2 FOR UPDATE",
      [proposalId, itemId]
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error("ITEM_NOT_FOUND");
    const siblingResult = await transaction.query(`
      SELECT id, position
      FROM proposal_items
      WHERE proposal_id = $1 AND position ${direction === "up" ? "<" : ">"} $2
      ORDER BY position ${direction === "up" ? "DESC" : "ASC"}
      LIMIT 1
      FOR UPDATE
    `, [proposalId, item.position]);
    const sibling = siblingResult.rows[0];
    if (!sibling) return;
    await transaction.query("UPDATE proposal_items SET position = -1 WHERE proposal_id = $1 AND id = $2", [proposalId, item.id]);
    await transaction.query("UPDATE proposal_items SET position = $3 WHERE proposal_id = $1 AND id = $2", [proposalId, sibling.id, item.position]);
    await transaction.query("UPDATE proposal_items SET position = $3 WHERE proposal_id = $1 AND id = $2", [proposalId, item.id, sibling.position]);
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'proposal_item', $2, 'moved', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto8.randomUUID)(), itemId, JSON.stringify({ position: item.position }), JSON.stringify({ position: sibling.position })]);
    logEvent("info", "proposal.item_moved", { proposalId, itemId, direction });
  });
};

// src/server/services/proposals.ts
var getProposalById = async (database, proposalId) => {
  const proposalResult = await database.query(`
    SELECT p.id, p.series_id::text AS series_id, p.client_id, p.work_id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name, p.scope, p.status, p.bdi_multiplier::text,
      COALESCE(p.tax_percentage, 0)::text AS tax_percentage,
      p.valid_until::text, u.name AS responsible_name, p.updated_at::text,
      NOT EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS is_latest,
      EXISTS (SELECT 1 FROM proposals approved WHERE approved.proposal_number = p.proposal_number AND approved.status = 'approved') AS has_approved_revision,
      (SELECT io.cost_center_id FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id AND io.status = 'delivered'
        ORDER BY io.delivered_at DESC LIMIT 1) AS cost_center_id,
      (SELECT io.contract_id FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id AND io.status = 'delivered'
        ORDER BY io.delivered_at DESC LIMIT 1) AS contract_id,
      (SELECT io.center_url FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id AND io.status = 'delivered'
        ORDER BY io.delivered_at DESC LIMIT 1) AS center_url
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    WHERE p.id = $1
  `, [proposalId]);
  const proposal = proposalResult.rows[0];
  if (!proposal) return null;
  const isDraftOrReview = proposal.status === "draft" || proposal.status === "review";
  const itemResult = await database.query(`
    SELECT pi.id, pi.snapshot_code, pi.snapshot_description, pi.snapshot_category, pi.quantity::text,
      pi.snapshot_unit, pi.snapshot_unit_cost::text, pi.sale_unit_price::text, pr.current_cost::text AS catalog_cost
    FROM proposal_items pi
    LEFT JOIN products pr ON pr.code = pi.snapshot_code AND pr.active = true
    WHERE pi.proposal_id = $1
    ORDER BY pi.position
  `, [proposal.id]);
  const items = itemResult.rows.map((item) => {
    const quantity2 = Number(item.quantity);
    const unitCost = Number(item.snapshot_unit_cost);
    const unitSale = Number(item.sale_unit_price);
    const catalogCurrentCost = isDraftOrReview && item.catalog_cost ? Number(item.catalog_cost) : null;
    return {
      id: item.id,
      code: item.snapshot_code,
      description: item.snapshot_description,
      category: item.snapshot_category ?? "Outros",
      quantity: quantity2,
      unit: item.snapshot_unit,
      unitCost,
      totalCost: multiplyDecimal([item.quantity, item.snapshot_unit_cost]),
      unitSale,
      totalSale: multiplyDecimal([item.quantity, item.sale_unit_price]),
      catalogCurrentCost
    };
  });
  const bdiMultiplier = Number(proposal.bdi_multiplier);
  const taxPercentage = Number(proposal.tax_percentage ?? 0);
  const laborItems = await listProposalLaborItems(database, proposal.id);
  const standardMonthlyHours = await getProposalStandardMonthlyHours(database, proposal.id);
  const materials = sumDecimal(items.map((item) => item.totalCost));
  const labor = sumDecimal(laborItems.map((item) => item.totalCost));
  const totals = calculateProposalTotals(materials, labor, bdiMultiplier, taxPercentage);
  const { baseCost, finalValue, additions } = totals;
  const taxAmount = totals.taxAmount ?? 0;
  const sale = sumDecimal(items.map((item) => item.totalSale));
  const grossResult = additions;
  return {
    id: proposal.id,
    seriesId: proposal.series_id,
    clientId: proposal.client_id,
    workId: proposal.work_id,
    number: proposal.proposal_number,
    revision: proposal.revision,
    clientName: proposal.client_name,
    workName: proposal.work_name,
    scope: proposal.scope,
    status: proposal.status,
    bdiMultiplier,
    taxPercentage,
    validUntil: proposal.valid_until ? proposal.valid_until.slice(0, 10) : null,
    responsibleName: proposal.responsible_name,
    updatedAt: proposal.updated_at,
    isLatest: proposal.is_latest,
    hasApprovedRevision: proposal.has_approved_revision,
    costCenterId: proposal.cost_center_id ?? void 0,
    contractId: proposal.contract_id ?? void 0,
    centroCustosUrl: proposal.center_url ?? void 0,
    items,
    laborItems,
    standardMonthlyHours,
    totals: {
      cost: materials,
      sale,
      grossResult,
      marginPercent: finalValue > 0 ? roundMoney(grossResult / finalValue * 100) : 0,
      materials,
      labor,
      baseCost,
      additions,
      taxAmount,
      finalValue
    }
  };
};
var getCurrentProposal = async (database) => {
  const latestIdResult = await database.query(`
    SELECT id
    FROM proposals
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const latestId = latestIdResult.rows[0]?.id;
  if (!latestId) return null;
  return getProposalById(database, latestId);
};
var listCurrentProposals = async (database) => {
  const result = await database.query(`
    SELECT p.id, p.proposal_number, p.revision,
      COALESCE(p.snapshot_client_name, c.trade_name, c.legal_name) AS client_name,
      COALESCE(p.snapshot_work_name, p.work_name) AS work_name,
      p.status,
      p.valid_until::text AS valid_until,
      count(i.id)::text AS item_count,
      ${baseCostSql}::text AS total_cost,
      ${finalValueSql}::text AS total_sale,
      u.name AS responsible_name, p.updated_at::text,
      NOT EXISTS (
        SELECT 1 FROM proposals newer
        WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
      ) AS is_latest,
      EXISTS (SELECT 1 FROM proposals approved WHERE approved.proposal_number = p.proposal_number AND approved.status = 'approved') AS has_approved_revision,
      (SELECT io.status FROM integration_outbox io
        JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
        WHERE s.proposal_id = p.id
        ORDER BY io.created_at DESC LIMIT 1) AS sync_status
    FROM proposals p
    JOIN clients c ON c.id = p.client_id
    JOIN users u ON u.id = p.created_by
    LEFT JOIN proposal_items i ON i.proposal_id = p.id
    GROUP BY p.id, c.trade_name, c.legal_name, u.name, p.bdi_multiplier, p.valid_until
    ORDER BY p.updated_at DESC
  `);
  return result.rows.map((row) => ({
    id: row.id,
    number: row.proposal_number,
    revision: row.revision,
    clientName: row.client_name,
    workName: row.work_name,
    status: row.status,
    validUntil: row.valid_until ? row.valid_until.slice(0, 10) : null,
    itemCount: Number(row.item_count),
    totalCost: roundMoney(Number(row.total_cost)),
    totalSale: roundMoney(Number(row.total_sale)),
    responsibleName: row.responsible_name,
    updatedAt: row.updated_at,
    isLatest: row.is_latest,
    hasApprovedRevision: row.has_approved_revision,
    syncStatus: row.sync_status ?? null
  }));
};
var updateProposalStatus = async (database, proposalId, status, userId) => {
  return updateProposalStatusWithGetter(database, proposalId, status, getProposalById, userId);
};

// src/server/routes/catalog.ts
var searchSchema = import_zod2.z.object({
  q: import_zod2.z.string().trim().max(120).default(""),
  limit: import_zod2.z.coerce.number().int().min(1).max(50).default(10)
});
var idSchema = import_zod2.z.string().uuid();
var productSchema = import_zod2.z.object({
  code: import_zod2.z.string().trim().min(2).max(60),
  manufacturer: import_zod2.z.string().trim().max(120).nullable().default(null),
  model: import_zod2.z.string().trim().max(120).nullable().default(null),
  description: import_zod2.z.string().trim().min(3).max(400),
  category: import_zod2.z.string().trim().min(2).max(120),
  unit: import_zod2.z.string().trim().min(1).max(20),
  currentCost: import_zod2.z.number().min(0).max(1e9),
  source: import_zod2.z.string().trim().min(2).max(120).default("CONSTRUTEC"),
  active: import_zod2.z.boolean().default(true)
});
var importSchema = import_zod2.z.object({ items: import_zod2.z.array(productSchema).min(1).max(500) });
var exsatSchema = import_zod2.z.object({ url: import_zod2.z.url().max(2e3) });
var actor = (response) => {
  const user = response.locals.authUser;
  if (!user) throw new Error("AUTH_INVALID_CREDENTIALS");
  return user;
};
var isValidImportedItem = (item) => !item.source.trim().toUpperCase().startsWith("EXSAT") || Number.isFinite(item.currentCost) && item.currentCost > 0;
var createCatalogRouter = (database) => {
  const router = (0, import_express2.Router)();
  router.get("/", async (request, response, next) => {
    try {
      const input = searchSchema.parse(request.query);
      response.json({ products: await searchCatalog(database, input.q, input.limit) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/manage", async (request, response, next) => {
    try {
      const query = import_zod2.z.string().trim().max(120).catch("").parse(request.query.q);
      response.json({ products: await listCatalogProducts(database, query) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/overview", async (_request, response, next) => {
    try {
      response.json({ overview: await getCatalogOverview(database, hasPermission(actor(response), "p10")) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/units", async (_request, response, next) => {
    try {
      response.json({ units: await listCatalogUnits(database) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (request, response, next) => {
    try {
      const productId = await createCatalogProduct(database, productSchema.parse(request.body));
      await attributeAuditEvent(database, actor(response).id, "product", productId, "created");
      response.status(201).json({ productId, products: await listCatalogProducts(database) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:productId", async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.productId);
      await updateCatalogProduct(database, productId, productSchema.parse(request.body));
      await attributeAuditEvent(database, actor(response).id, "product", productId, "updated");
      response.json({ products: await listCatalogProducts(database) });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/:productId", async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.productId);
      const check = await database.query("SELECT id FROM catalog_products WHERE id = $1", [productId]);
      if (!check.rows[0]) {
        response.status(404).json({ error: "Produto n\xE3o encontrado no cat\xE1logo." });
        return;
      }
      const usedInProposal = await database.query(
        "SELECT id FROM proposal_items WHERE snapshot_code = (SELECT code FROM catalog_products WHERE id = $1) LIMIT 1",
        [productId]
      );
      if (usedInProposal.rows[0]) {
        response.status(409).json({ error: "Produto vinculado a proposta(s). N\xE3o \xE9 poss\xEDvel excluir." });
        return;
      }
      await database.query("DELETE FROM catalog_products WHERE id = $1", [productId]);
      await attributeAuditEvent(database, actor(response).id, "product", productId, "deleted");
      response.json({ products: await listCatalogProducts(database) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/import/preview", async (request, response, next) => {
    try {
      const input = importSchema.parse(request.body);
      response.json(await previewCatalogImport(database, input.items));
    } catch (error) {
      next(error);
    }
  });
  router.post("/import/bulk", async (request, response, next) => {
    try {
      const input = importSchema.parse(request.body);
      const result = await importCatalogProducts(database, input.items);
      const codes = input.items.filter(isValidImportedItem).map((item) => item.code);
      await attributeCatalogBatchAudit(database, actor(response).id, codes, result);
      response.status(201).json({ ...result, products: await listCatalogProducts(database) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/import/exsat", async (request, response, next) => {
    try {
      const input = exsatSchema.parse(request.body);
      response.json({ items: await previewExsatProducts(input.url) });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/clients.ts
var import_express3 = require("express");
var import_zod3 = require("zod");

// src/server/services/clients.ts
var import_node_crypto9 = require("node:crypto");
var mapWork = (work) => ({
  id: work.id,
  clientId: work.client_id,
  name: work.name,
  address: work.address,
  active: work.active,
  updatedAt: work.updated_at
});
var listClients = async (database, query = "") => {
  const pattern = `%${query.trim()}%`;
  const clients = await database.query(`
    SELECT id, legal_name, trade_name, document, updated_at::text
    FROM clients
    WHERE $1 = '%%'
      OR legal_name ILIKE $1
      OR trade_name ILIKE $1
      OR document ILIKE $1
      OR EXISTS (SELECT 1 FROM works WHERE works.client_id = clients.id AND works.name ILIKE $1)
    ORDER BY COALESCE(trade_name, legal_name)
    LIMIT 200
  `, [pattern]);
  if (clients.rows.length === 0) return [];
  const works = await database.query(`
    SELECT id, client_id, name, address, active, updated_at::text
    FROM works
    WHERE client_id = ANY($1::uuid[])
    ORDER BY active DESC, name
  `, [clients.rows.map((client) => client.id)]);
  return clients.rows.map((client) => ({
    id: client.id,
    legalName: client.legal_name,
    tradeName: client.trade_name,
    document: client.document,
    updatedAt: client.updated_at,
    works: works.rows.filter((work) => work.client_id === client.id).map(mapWork)
  }));
};
var createClient = async (database, input) => {
  const clientId = (0, import_node_crypto9.randomUUID)();
  await database.transaction(async (transaction) => {
    await transaction.query(
      "INSERT INTO clients (id, legal_name, trade_name, document) VALUES ($1, $2, $3, $4)",
      [clientId, input.legalName.trim(), input.tradeName?.trim() || null, input.document?.trim() || null]
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'client', $2, 'created', $3::jsonb)
    `, [(0, import_node_crypto9.randomUUID)(), clientId, JSON.stringify(input)]);
  });
  return clientId;
};
var updateClient = async (database, clientId, input) => {
  await database.transaction(async (transaction) => {
    const before = await transaction.query(
      "SELECT id, legal_name, trade_name, document, updated_at::text FROM clients WHERE id = $1 FOR UPDATE",
      [clientId]
    );
    if (!before.rows[0]) throw new Error("CLIENT_NOT_FOUND");
    await transaction.query(`
      UPDATE clients
      SET legal_name = $2, trade_name = $3, document = $4, revision = revision + 1, updated_at = now()
      WHERE id = $1
    `, [clientId, input.legalName.trim(), input.tradeName?.trim() || null, input.document?.trim() || null]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'client', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto9.randomUUID)(), clientId, JSON.stringify(before.rows[0]), JSON.stringify(input)]);
  });
};
var createWork = async (database, clientId, input) => {
  const workId = (0, import_node_crypto9.randomUUID)();
  await database.transaction(async (transaction) => {
    const client = await transaction.query("SELECT id FROM clients WHERE id = $1", [clientId]);
    if (!client.rows[0]) throw new Error("CLIENT_NOT_FOUND");
    const duplicate = await transaction.query(
      "SELECT id FROM works WHERE client_id = $1 AND lower(name) = lower($2)",
      [clientId, input.name.trim()]
    );
    if (duplicate.rows[0]) throw new Error("WORK_DUPLICATE");
    await transaction.query(
      "INSERT INTO works (id, client_id, name, address) VALUES ($1, $2, $3, $4)",
      [workId, clientId, input.name.trim(), input.address?.trim() || null]
    );
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, after_data)
      VALUES ($1, 'work', $2, 'created', $3::jsonb)
    `, [(0, import_node_crypto9.randomUUID)(), workId, JSON.stringify({ clientId, ...input })]);
  });
  return workId;
};
var updateWork = async (database, clientId, workId, input) => {
  await database.transaction(async (transaction) => {
    const before = await transaction.query(`
      SELECT id, client_id, name, address, active, updated_at::text
      FROM works WHERE id = $1 AND client_id = $2 FOR UPDATE
    `, [workId, clientId]);
    if (!before.rows[0]) throw new Error("WORK_NOT_FOUND");
    const duplicate = await transaction.query(
      "SELECT id FROM works WHERE client_id = $1 AND lower(name) = lower($2) AND id <> $3",
      [clientId, input.name.trim(), workId]
    );
    if (duplicate.rows[0]) throw new Error("WORK_DUPLICATE");
    await transaction.query(`
      UPDATE works
      SET name = $3, address = $4, active = $5, revision = revision + 1, updated_at = now()
      WHERE id = $1 AND client_id = $2
    `, [workId, clientId, input.name.trim(), input.address?.trim() || null, input.active]);
    await transaction.query(`
      INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
      VALUES ($1, 'work', $2, 'updated', $3::jsonb, $4::jsonb)
    `, [(0, import_node_crypto9.randomUUID)(), workId, JSON.stringify(before.rows[0]), JSON.stringify(input)]);
  });
};

// src/server/routes/clients.ts
var idSchema2 = import_zod3.z.string().uuid();
var clientSchema = import_zod3.z.object({
  legalName: import_zod3.z.string().trim().min(2).max(180),
  tradeName: import_zod3.z.string().trim().max(180).nullable().optional(),
  document: import_zod3.z.string().trim().max(30).nullable().optional()
});
var workSchema = import_zod3.z.object({
  name: import_zod3.z.string().trim().min(2).max(180),
  address: import_zod3.z.string().trim().max(300).nullable().optional()
});
var updateWorkSchema = workSchema.extend({ active: import_zod3.z.boolean() });
var actor2 = (response) => {
  const user = response.locals.authUser;
  if (!user) throw new Error("AUTH_INVALID_CREDENTIALS");
  return user;
};
var createClientsRouter = (database) => {
  const router = (0, import_express3.Router)();
  router.get("/", async (request, response, next) => {
    try {
      const query = import_zod3.z.string().max(120).catch("").parse(request.query.q);
      response.json({ clients: await listClients(database, query) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (request, response, next) => {
    try {
      const input = clientSchema.parse(request.body);
      const clientId = await createClient(database, input);
      await attributeAuditEvent(database, actor2(response).id, "client", clientId, "created");
      response.status(201).json({ clientId, clients: await listClients(database) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:clientId", async (request, response, next) => {
    try {
      const clientId = idSchema2.parse(request.params.clientId);
      await updateClient(database, clientId, clientSchema.parse(request.body));
      await attributeAuditEvent(database, actor2(response).id, "client", clientId, "updated");
      response.json({ clients: await listClients(database) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:clientId/works", async (request, response, next) => {
    try {
      const clientId = idSchema2.parse(request.params.clientId);
      const workId = await createWork(database, clientId, workSchema.parse(request.body));
      await attributeAuditEvent(database, actor2(response).id, "work", workId, "created");
      response.status(201).json({ workId, clients: await listClients(database) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:clientId/works/:workId", async (request, response, next) => {
    try {
      const clientId = idSchema2.parse(request.params.clientId);
      const workId = idSchema2.parse(request.params.workId);
      await updateWork(database, clientId, workId, updateWorkSchema.parse(request.body));
      await attributeAuditEvent(database, actor2(response).id, "work", workId, "updated");
      response.json({ clients: await listClients(database) });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/dashboard.ts
var import_express4 = require("express");

// src/server/services/dashboard.ts
var roundMoney2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
var STAGE_ORDER = ["draft", "review", "sent", "approved", "rejected"];
var STAGE_LABELS = {
  draft: "Em edi\xE7\xE3o",
  review: "Em revis\xE3o",
  sent: "Enviada / Negocia\xE7\xE3o",
  approved: "Aprovada",
  rejected: "Recusada"
};
var getDashboardSummary = async (database) => {
  const [recentProposals, countsResult, pipelineResult, itemsResult, clientsResult] = await Promise.all([
    listCurrentProposals(database),
    database.query(`
      WITH current_proposals AS (
        SELECT p.id, p.status, p.bdi_multiplier,
          ${finalValueSql} AS total_val
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT
        (SELECT count(*)::text FROM current_proposals WHERE status IN ('draft', 'review', 'sent')) AS active_proposals_count,
        (SELECT count(*)::text FROM current_proposals WHERE status = 'approved') AS approved_proposals_count,
        COALESCE((SELECT SUM(total_val)::text FROM current_proposals WHERE status IN ('draft', 'review', 'sent')), '0') AS total_in_negotiation,
        COALESCE((SELECT SUM(total_val)::text FROM current_proposals WHERE status = 'approved'), '0') AS total_approved,
        (SELECT count(*)::text FROM clients) AS total_clients,
        (SELECT count(*)::text FROM products WHERE active = true) AS total_products,
        (SELECT count(*)::text FROM kits WHERE active = true) AS total_kits
    `),
    database.query(`
      WITH current_proposals AS (
        SELECT p.id, p.status, p.bdi_multiplier,
          ${finalValueSql} AS total_val
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT status, count(*)::text AS count, COALESCE(SUM(total_val)::text, '0') AS total_val
      FROM current_proposals
      GROUP BY status
    `),
    database.query(`
      WITH current_proposals AS (
        SELECT p.id, p.bdi_multiplier
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT
        COALESCE(pi.snapshot_code, '') AS product_code,
        pi.snapshot_description AS description,
        pi.snapshot_unit AS unit,
        COALESCE(pi.snapshot_category, 'Outros') AS category,
        SUM(pi.quantity)::text AS total_quantity,
        ROUND(SUM(pi.quantity * pi.snapshot_unit_cost * cp.bdi_multiplier), 2)::text AS total_value,
        COUNT(DISTINCT pi.proposal_id)::text AS proposals_count
      FROM proposal_items pi
      JOIN current_proposals cp ON cp.id = pi.proposal_id
      GROUP BY pi.snapshot_code, pi.snapshot_description, pi.snapshot_unit, pi.snapshot_category
      ORDER BY ROUND(SUM(pi.quantity * pi.snapshot_unit_cost * cp.bdi_multiplier), 2) DESC
      LIMIT 12
    `),
    database.query(`
      WITH current_proposals AS (
        SELECT p.id, p.client_id, p.snapshot_client_name, p.status, p.bdi_multiplier,
          ${finalValueSql} AS total_val
        FROM proposals p
        WHERE NOT EXISTS (
          SELECT 1 FROM proposals newer
          WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision
        )
      )
      SELECT
        COALESCE(NULLIF(trim(cp.snapshot_client_name), ''), c.trade_name, c.legal_name, 'Cliente n\xE3o informado') AS client_name,
        COUNT(*)::text AS proposals_count,
        COALESCE(SUM(CASE WHEN cp.status = 'approved' THEN cp.total_val ELSE 0 END)::text, '0') AS approved_value,
        COALESCE(SUM(CASE WHEN cp.status IN ('draft', 'review', 'sent') THEN cp.total_val ELSE 0 END)::text, '0') AS in_negotiation_value,
        COALESCE(SUM(cp.total_val)::text, '0') AS total_value
      FROM current_proposals cp
      LEFT JOIN clients c ON c.id = cp.client_id
      GROUP BY COALESCE(NULLIF(trim(cp.snapshot_client_name), ''), c.trade_name, c.legal_name, 'Cliente n\xE3o informado')
      ORDER BY SUM(cp.total_val) DESC
      LIMIT 8
    `)
  ]);
  const row = countsResult.rows[0];
  const activeCount = Number(row?.active_proposals_count ?? 0);
  const approvedCount = Number(row?.approved_proposals_count ?? 0);
  const totalInNegotiation = roundMoney2(Number(row?.total_in_negotiation ?? 0));
  const totalApproved = roundMoney2(Number(row?.total_approved ?? 0));
  const statusMap = /* @__PURE__ */ new Map();
  let grandPipelineValue = 0;
  for (const r of pipelineResult.rows) {
    const val = roundMoney2(Number(r.total_val));
    statusMap.set(r.status, { count: Number(r.count), totalVal: val });
    grandPipelineValue += val;
  }
  const pipeline = STAGE_ORDER.map((st) => {
    const data = statusMap.get(st) ?? { count: 0, totalVal: 0 };
    const pct = grandPipelineValue > 0 ? Math.round(data.totalVal / grandPipelineValue * 1e3) / 10 : 0;
    return {
      status: st,
      label: STAGE_LABELS[st],
      count: data.count,
      totalValue: data.totalVal,
      percentage: pct
    };
  });
  const rejectedCount = statusMap.get("rejected")?.count ?? 0;
  const decidedCount = approvedCount + rejectedCount;
  const conversionRate = decidedCount > 0 ? Math.round(approvedCount / decidedCount * 1e3) / 10 : 0;
  const averageTicketApproved = approvedCount > 0 ? roundMoney2(totalApproved / approvedCount) : 0;
  const averageTicketNegotiation = activeCount > 0 ? roundMoney2(totalInNegotiation / activeCount) : 0;
  const rawItems = itemsResult.rows.map((r) => ({
    code: r.product_code,
    description: r.description,
    unit: r.unit,
    category: r.category,
    totalQuantity: Number(r.total_quantity),
    totalValue: roundMoney2(Number(r.total_value)),
    proposalsCount: Number(r.proposals_count)
  }));
  const itemsTotalSum = rawItems.reduce((acc, it) => acc + it.totalValue, 0);
  let runningSum = 0;
  const topItems = rawItems.map((it) => {
    runningSum += it.totalValue;
    const cumPct = itemsTotalSum > 0 ? Math.round(runningSum / itemsTotalSum * 1e3) / 10 : 0;
    let abcClass = "A";
    if (cumPct > 95) abcClass = "C";
    else if (cumPct > 80) abcClass = "B";
    return {
      ...it,
      cumulativePercentage: cumPct,
      abcClass
    };
  });
  const topClients = clientsResult.rows.map((r) => ({
    clientName: r.client_name,
    proposalsCount: Number(r.proposals_count),
    approvedValue: roundMoney2(Number(r.approved_value)),
    inNegotiationValue: roundMoney2(Number(r.in_negotiation_value)),
    totalValue: roundMoney2(Number(r.total_value))
  }));
  const intelligence = {
    conversionRate,
    averageTicketApproved,
    averageTicketNegotiation,
    pipeline,
    topItems,
    topClients
  };
  return {
    activeProposalsCount: activeCount,
    approvedProposalsCount: approvedCount,
    totalInNegotiation,
    totalApproved,
    totalClientsCount: Number(row?.total_clients ?? 0),
    totalProductsCount: Number(row?.total_products ?? 0),
    totalKitsCount: Number(row?.total_kits ?? 0),
    recentProposals: recentProposals.slice(0, 10),
    intelligence
  };
};

// src/server/routes/dashboard.ts
var createDashboardRouter = (database) => {
  const router = (0, import_express4.Router)();
  router.get("/", async (_request, response, next) => {
    try {
      const summary = await getDashboardSummary(database);
      response.json({ summary });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/notifications.ts
var import_express5 = require("express");
var import_zod4 = require("zod");
var readSchema = import_zod4.z.union([
  import_zod4.z.object({ all: import_zod4.z.literal(true) }),
  import_zod4.z.object({ ids: import_zod4.z.array(import_zod4.z.string().uuid()).min(1).max(100) })
]);
var prefSchema = import_zod4.z.object({ type: import_zod4.z.string().trim().min(2).max(40), enabled: import_zod4.z.boolean() });
var limitSchema = import_zod4.z.coerce.number().int().min(1).max(100).default(50);
var token = (response) => response.locals.sessionToken || "";
var relay = async (work) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CentroIdentityError && error.status === 401) {
      throw new CentroIdentityError("N\xE3o foi poss\xEDvel abrir as notifica\xE7\xF5es agora.", 503, "IDENTITY_UNAVAILABLE");
    }
    throw error;
  }
};
var createNotificationsRouter = () => {
  const router = (0, import_express5.Router)();
  router.get("/", async (request, response, next) => {
    try {
      const limit = limitSchema.parse(request.query.limit);
      response.json(await relay(() => centroNotifications(token(response), "/v1/notifications", "GET", void 0, `?limit=${limit}`)));
    } catch (error) {
      next(error);
    }
  });
  router.post("/read", async (request, response, next) => {
    try {
      const body = readSchema.parse(request.body);
      response.json(await relay(() => centroNotifications(token(response), "/v1/notifications/read", "POST", body)));
    } catch (error) {
      next(error);
    }
  });
  router.get("/prefs", async (_request, response, next) => {
    try {
      response.json(await relay(() => centroNotifications(token(response), "/v1/notifications/prefs")));
    } catch (error) {
      next(error);
    }
  });
  router.put("/prefs", async (request, response, next) => {
    try {
      const body = prefSchema.parse(request.body);
      response.json(await relay(() => centroNotifications(token(response), "/v1/notifications/prefs", "PUT", body)));
    } catch (error) {
      next(error);
    }
  });
  router.post("/test", async (_request, response, next) => {
    try {
      response.json(await relay(() => centroNotifications(token(response), "/v1/notifications/test", "POST", {})));
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/kits.ts
var import_express6 = require("express");
var import_zod5 = require("zod");

// src/server/services/kits.ts
var import_node_crypto10 = require("node:crypto");
var roundMoney3 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
var listKits = async (database, query = "") => {
  const pattern = `%${query.trim()}%`;
  const result = await database.query(`
    SELECT
      k.id,
      k.name,
      k.description,
      k.category,
      k.active,
      count(ki.id)::text AS item_count,
      COALESCE(SUM(ki.quantity * p.current_cost), 0)::text AS total_estimated_cost,
      k.updated_at::text
    FROM kits k
    LEFT JOIN kit_items ki ON ki.kit_id = k.id
    LEFT JOIN products p ON p.id = ki.catalog_product_id
    WHERE $1 = '%%' OR k.name ILIKE $1 OR k.category ILIKE $1 OR k.description ILIKE $1
    GROUP BY k.id, k.name, k.description, k.category, k.active, k.updated_at
    ORDER BY k.active DESC, k.category, k.name
    LIMIT 200
  `, [pattern]);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    active: row.active,
    itemCount: Number(row.item_count),
    totalEstimatedCost: roundMoney3(Number(row.total_estimated_cost)),
    updatedAt: row.updated_at
  }));
};
var getKitById = async (database, id) => {
  const kitResult = await database.query("SELECT id, name, description, category, active, updated_at::text FROM kits WHERE id = $1", [id]);
  const kit = kitResult.rows[0];
  if (!kit) throw new Error("KIT_NOT_FOUND");
  const itemsResult = await database.query(`
    SELECT
      ki.id,
      ki.catalog_product_id as product_id,
      COALESCE(p.code, ki.snapshot_code) as code,
      COALESCE(p.description, ki.snapshot_description) as description,
      COALESCE(p.category, 'Geral') as category,
      COALESCE(p.unit, ki.snapshot_unit) as unit,
      COALESCE(p.current_cost::text, '0') as current_cost,
      ki.quantity::text,
      ki.position
    FROM kit_items ki
    LEFT JOIN products p ON p.id = ki.catalog_product_id
    WHERE ki.kit_id = $1
    ORDER BY ki.position ASC
  `, [id]);
  let totalCost = 0;
  const items = itemsResult.rows.map((row) => {
    const unitCost = Number(row.current_cost);
    const quantity2 = Number(row.quantity);
    const itemTotal = roundMoney3(unitCost * quantity2);
    totalCost += itemTotal;
    return {
      id: row.id,
      productId: row.product_id,
      code: row.code,
      description: row.description,
      category: row.category,
      unit: row.unit,
      currentCost: unitCost,
      quantity: quantity2,
      totalCost: itemTotal,
      position: row.position
    };
  });
  return {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    category: kit.category,
    active: kit.active,
    itemCount: items.length,
    totalEstimatedCost: roundMoney3(totalCost),
    updatedAt: kit.updated_at,
    items
  };
};
var createKit = async (database, input) => {
  const kitId = (0, import_node_crypto10.randomUUID)();
  await database.transaction(async (transaction) => {
    const existing = await transaction.query(
      "SELECT id FROM kits WHERE lower(name) = lower($1)",
      [input.name.trim()]
    );
    if (existing.rows[0]) throw new Error("KIT_NAME_DUPLICATE");
    await transaction.query(`
      INSERT INTO kits (id, name, description, category, active)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      kitId,
      input.name.trim(),
      input.description?.trim() ?? "",
      input.category?.trim() || "Geral",
      input.active !== false
    ]);
    for (const [index, item] of input.items.entries()) {
      if (item.quantity <= 0) continue;
      const prodRes = await transaction.query("SELECT code, description, unit FROM products WHERE id = $1", [item.productId]);
      const prod = prodRes.rows[0];
      if (!prod) throw new Error("PRODUCT_NOT_FOUND");
      await transaction.query(`
        INSERT INTO kit_items (id, kit_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        (0, import_node_crypto10.randomUUID)(),
        kitId,
        item.productId,
        index + 1,
        prod.code,
        prod.description,
        prod.unit,
        item.quantity
      ]);
    }
  });
  return getKitById(database, kitId);
};
var updateKit = async (database, id, input) => {
  await database.transaction(async (transaction) => {
    const kit = await transaction.query("SELECT id FROM kits WHERE id = $1", [id]);
    if (!kit.rows[0]) throw new Error("KIT_NOT_FOUND");
    const duplicate = await transaction.query(
      "SELECT id FROM kits WHERE lower(name) = lower($1) AND id <> $2",
      [input.name.trim(), id]
    );
    if (duplicate.rows[0]) throw new Error("KIT_NAME_DUPLICATE");
    await transaction.query(`
      UPDATE kits
      SET name = $2, description = $3, category = $4, active = $5, updated_at = now()
      WHERE id = $1
    `, [
      id,
      input.name.trim(),
      input.description?.trim() ?? "",
      input.category?.trim() || "Geral",
      input.active !== false
    ]);
    await transaction.query("DELETE FROM kit_items WHERE kit_id = $1", [id]);
    for (const [index, item] of input.items.entries()) {
      if (item.quantity <= 0) continue;
      const prodRes = await transaction.query("SELECT code, description, unit FROM products WHERE id = $1", [item.productId]);
      const prod = prodRes.rows[0];
      if (!prod) throw new Error("PRODUCT_NOT_FOUND");
      await transaction.query(`
        INSERT INTO kit_items (id, kit_id, catalog_product_id, position, snapshot_code, snapshot_description, snapshot_unit, quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        (0, import_node_crypto10.randomUUID)(),
        id,
        item.productId,
        index + 1,
        prod.code,
        prod.description,
        prod.unit,
        item.quantity
      ]);
    }
  });
  return getKitById(database, id);
};
var deleteKit = async (database, id) => {
  const result = await database.query("DELETE FROM kits WHERE id = $1", [id]);
  if ((result.affectedRows ?? 0) === 0) {
    const check = await database.query("SELECT id FROM kits WHERE id = $1", [id]);
    if (!check.rows[0]) throw new Error("KIT_NOT_FOUND");
  }
};
var applyKitToProposal = async (database, kitId, proposalId) => {
  const kit = await getKitById(database, kitId);
  if (kit.items.length === 0) throw new Error("KIT_EMPTY");
  await database.transaction(async (transaction) => {
    const proposalRes = await transaction.query("SELECT id, bdi_multiplier, status FROM proposals WHERE id = $1", [proposalId]);
    const proposal = proposalRes.rows[0];
    if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
    if (proposal.status !== "draft") throw new Error("PROPOSAL_LOCKED");
    const bdiMultiplier = Number(proposal.bdi_multiplier);
    const maxPosRes = await transaction.query(
      "SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1",
      [proposalId]
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);
    for (const item of kit.items) {
      nextPosition += 1;
      const unitCost = item.currentCost;
      const saleUnitPrice = roundMoney3(unitCost * bdiMultiplier);
      const productRes = await transaction.query("SELECT code, manufacturer, model, description, category, unit FROM products WHERE id = $1", [item.productId]);
      const prod = productRes.rows[0];
      if (!prod) continue;
      await transaction.query(`
        INSERT INTO proposal_items (
          id, proposal_id, catalog_product_id, position, snapshot_code,
          snapshot_manufacturer, snapshot_model, snapshot_description,
          snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
          sale_unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        (0, import_node_crypto10.randomUUID)(),
        proposalId,
        item.productId,
        nextPosition,
        prod.code,
        prod.manufacturer,
        prod.model,
        prod.description,
        prod.category || "Outros",
        prod.unit,
        unitCost,
        item.quantity,
        saleUnitPrice
      ]);
    }
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
  });
  const updated = await getProposalById(database, proposalId);
  if (!updated) throw new Error("PROPOSAL_NOT_FOUND");
  return updated;
};

// src/server/routes/kits.ts
var idSchema3 = import_zod5.z.string().uuid();
var kitItemInputSchema = import_zod5.z.object({
  productId: import_zod5.z.string().uuid(),
  quantity: import_zod5.z.number().positive().max(999999)
});
var kitInputSchema = import_zod5.z.object({
  name: import_zod5.z.string().trim().min(2).max(180),
  description: import_zod5.z.string().trim().max(500).nullable().optional(),
  category: import_zod5.z.string().trim().min(1).max(120).default("Geral"),
  active: import_zod5.z.boolean().optional(),
  items: import_zod5.z.array(kitItemInputSchema).default([])
});
var createKitsRouter = (database) => {
  const router = (0, import_express6.Router)();
  router.get("/", async (request, response, next) => {
    try {
      const query = import_zod5.z.string().max(120).catch("").parse(request.query.q);
      const kits = await listKits(database, query);
      response.json({ kits });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:kitId", async (request, response, next) => {
    try {
      const kitId = idSchema3.parse(request.params.kitId);
      const kit = await getKitById(database, kitId);
      response.json({ kit });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (request, response, next) => {
    try {
      const input = kitInputSchema.parse(request.body);
      const kit = await createKit(database, input);
      const kits = await listKits(database);
      response.status(201).json({ kit, kits });
    } catch (error) {
      next(error);
    }
  });
  router.put("/:kitId", async (request, response, next) => {
    try {
      const kitId = idSchema3.parse(request.params.kitId);
      const input = kitInputSchema.parse(request.body);
      const kit = await updateKit(database, kitId, input);
      const kits = await listKits(database);
      response.json({ kit, kits });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/:kitId", async (request, response, next) => {
    try {
      const kitId = idSchema3.parse(request.params.kitId);
      await deleteKit(database, kitId);
      const kits = await listKits(database);
      response.json({ success: true, kits });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:kitId/apply-to-proposal", async (request, response, next) => {
    try {
      const kitId = idSchema3.parse(request.params.kitId);
      const { proposalId } = import_zod5.z.object({ proposalId: import_zod5.z.string().uuid() }).parse(request.body);
      const proposal = await applyKitToProposal(database, kitId, proposalId);
      response.json({ proposal });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/proposals.ts
var import_express7 = require("express");
var import_zod6 = require("zod");

// src/server/services/proposalAttribution.ts
var attributeProposalCreation = async (database, proposalId, userId, action) => {
  await database.transaction(async (transaction) => {
    const proposal = await transaction.query(
      "UPDATE proposals SET created_by = $2, updated_at = now() WHERE id = $1 RETURNING id",
      [proposalId, userId]
    );
    if (!proposal.rows[0]) throw new Error("PROPOSAL_NOT_FOUND");
    await transaction.query(`
      UPDATE audit_events
      SET user_id = $2
      WHERE entity_type = 'proposal' AND entity_id = $1 AND action = $3
    `, [proposalId, userId, action]);
  });
};

// src/server/services/proposalImport.ts
var import_node_crypto11 = require("node:crypto");
var importProposalItemsBatch = async (database, proposalId, items, userId) => {
  if (items.length === 0) throw new Error("EMPTY_ITEMS_LIST");
  await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    const bdiMultiplier = Number(proposal.bdi_multiplier);
    const maxPosRes = await transaction.query(
      "SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1",
      [proposalId]
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);
    for (const item of items) {
      if (item.quantity <= 0) continue;
      nextPosition += 1;
      const itemId = (0, import_node_crypto11.randomUUID)();
      let catalogProductId = null;
      let code = item.code?.trim() || `ITEM-${String(nextPosition).padStart(3, "0")}`;
      let description = item.description.trim();
      let category = item.category?.trim() || "Importado";
      let unit = item.unit?.trim() || "un";
      let manufacturer = null;
      let model = null;
      let unitCost = item.unitCost !== void 0 && item.unitCost >= 0 ? item.unitCost : 0;
      if (item.code?.trim()) {
        const prodRes = await transaction.query(
          "SELECT id, code, manufacturer, model, description, category, unit, current_cost::text FROM products WHERE code = $1 AND active = true LIMIT 1",
          [item.code.trim()]
        );
        const prod = prodRes.rows[0];
        if (prod) {
          catalogProductId = prod.id;
          code = prod.code;
          manufacturer = prod.manufacturer;
          model = prod.model;
          if (!description) description = prod.description;
          if (!item.category) category = prod.category;
          if (!item.unit) unit = prod.unit;
          if (item.unitCost === void 0 || item.unitCost === null) {
            unitCost = Number(prod.current_cost);
          }
        }
      }
      const saleUnitPrice = item.unitSale !== void 0 && item.unitSale >= 0 ? item.unitSale : roundMoney(unitCost * bdiMultiplier);
      await transaction.query(`
        INSERT INTO proposal_items (
          id, proposal_id, catalog_product_id, position, snapshot_code,
          snapshot_manufacturer, snapshot_model, snapshot_description,
          snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
          sale_unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        itemId,
        proposalId,
        catalogProductId,
        nextPosition,
        code,
        manufacturer,
        model,
        description,
        category,
        unit,
        unitCost,
        item.quantity,
        saleUnitPrice
      ]);
    }
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal', $3, 'items_imported', $4::jsonb)
    `, [(0, import_node_crypto11.randomUUID)(), userId ?? null, proposalId, JSON.stringify({ count: items.length })]);
    logEvent("info", "proposal.items_imported", { proposalId, count: items.length });
  });
  const updated = await getProposalById(database, proposalId);
  if (!updated) throw new Error("PROPOSAL_NOT_FOUND");
  return updated;
};
var copyItemsFromProposal = async (database, targetProposalId, sourceProposalId, itemIds, userId) => {
  await database.transaction(async (transaction) => {
    const targetProposal = await getEditableProposal(transaction, targetProposalId);
    const bdiMultiplier = Number(targetProposal.bdi_multiplier);
    let query = `
      SELECT catalog_product_id, snapshot_code, snapshot_manufacturer,
        snapshot_model, snapshot_description, snapshot_category,
        snapshot_unit, snapshot_unit_cost::text, quantity::text, sale_unit_price::text
      FROM proposal_items
      WHERE proposal_id = $1
    `;
    const params = [sourceProposalId];
    if (itemIds && itemIds.length > 0) {
      query += " AND id = ANY($2::uuid[])";
      params.push(itemIds);
    }
    query += " ORDER BY position ASC";
    const sourceItems = await transaction.query(query, params);
    if (sourceItems.rows.length === 0) throw new Error("NO_ITEMS_FOUND");
    const maxPosRes = await transaction.query(
      "SELECT max(position)::text AS max_pos FROM proposal_items WHERE proposal_id = $1",
      [targetProposalId]
    );
    let nextPosition = Number(maxPosRes.rows[0]?.max_pos ?? 0);
    for (const item of sourceItems.rows) {
      nextPosition += 1;
      const itemId = (0, import_node_crypto11.randomUUID)();
      const unitCost = Number(item.snapshot_unit_cost);
      const saleUnitPrice = roundMoney(unitCost * bdiMultiplier);
      await transaction.query(`
        INSERT INTO proposal_items (
          id, proposal_id, catalog_product_id, position, snapshot_code,
          snapshot_manufacturer, snapshot_model, snapshot_description,
          snapshot_category, snapshot_unit, snapshot_unit_cost, quantity,
          sale_unit_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        itemId,
        targetProposalId,
        item.catalog_product_id,
        nextPosition,
        item.snapshot_code,
        item.snapshot_manufacturer,
        item.snapshot_model,
        item.snapshot_description,
        item.snapshot_category || "Geral",
        item.snapshot_unit,
        unitCost,
        Number(item.quantity),
        saleUnitPrice
      ]);
    }
    await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [targetProposalId]);
    await transaction.query(`
      INSERT INTO audit_events (id, user_id, entity_type, entity_id, action, after_data)
      VALUES ($1, $2, 'proposal', $3, 'items_copied', $4::jsonb)
    `, [(0, import_node_crypto11.randomUUID)(), userId ?? null, targetProposalId, JSON.stringify({ sourceProposalId, count: sourceItems.rows.length })]);
    logEvent("info", "proposal.items_copied", { targetProposalId, sourceProposalId, count: sourceItems.rows.length });
  });
  const updated = await getProposalById(database, targetProposalId);
  if (!updated) throw new Error("PROPOSAL_NOT_FOUND");
  return updated;
};

// src/server/services/integration/proposalExport.ts
var import_node_crypto12 = require("node:crypto");
var exportProposalIntegration = async (database, proposalId, userId, markExported = true) => {
  const proposalResult = await database.query(
    "SELECT id, status, proposal_number FROM proposals WHERE id = $1",
    [proposalId]
  );
  const proposal = proposalResult.rows[0];
  if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
  if (proposal.status !== "approved") throw new Error("PROPOSAL_NOT_APPROVED");
  let snapshot = (await database.query("SELECT * FROM proposal_approval_snapshots WHERE proposal_id = $1", [proposalId])).rows[0];
  if (!snapshot) {
    const sealed = await sealProposalInTransaction(database, proposalId, userId);
    if (!sealed) throw new Error("SEAL_FAILED");
    snapshot = (await database.query("SELECT * FROM proposal_approval_snapshots WHERE id = $1", [sealed.id])).rows[0];
  }
  const outboxResult = await database.query("SELECT id, status, attempts, created_at FROM integration_outbox WHERE snapshot_id = $1 AND destination = $2", [
    snapshot.id,
    "centro-de-custos"
  ]);
  const outbox = outboxResult.rows[0];
  const eventId = outbox?.id || (0, import_node_crypto12.randomUUID)();
  const payload = typeof snapshot.payload === "string" ? JSON.parse(snapshot.payload) : snapshot.payload;
  const envelope = {
    schemaVersion: "1.0.0",
    eventId,
    emittedAt: snapshot.sealed_at,
    payloadSha256: snapshot.payload_sha256,
    payload
  };
  if (outbox && markExported) {
    await database.query(
      "UPDATE integration_outbox SET attempts = attempts + 1, delivered_at = now(), status = $2 WHERE id = $1",
      [outbox.id, "delivered"]
    );
  }
  return {
    envelope,
    snapshotId: snapshot.id,
    eventId
  };
};

// src/server/services/integration/proposalSync.ts
var DEFAULT_CENTER_URL = "https://centro-custos-api.construtec-reports.workers.dev/api/integracao/orcamentos/sync-direto";
var DEFAULT_INTEGRATION_KEY = "construtec-internal-integration-secret-2026";
var MIN_CLOUD_KEY_LENGTH = 32;
var normalizeServiceKey = (value) => (value || "").replace(/^\uFEFF/, "").trim();
var resolveIntegrationKey = () => {
  const configured = normalizeServiceKey(process.env.CONSTRUTEC_INTEGRATION_KEY);
  if (!process.env.DATABASE_URL) return configured || DEFAULT_INTEGRATION_KEY;
  if (configured.length < MIN_CLOUD_KEY_LENGTH || configured === DEFAULT_INTEGRATION_KEY) return null;
  return configured;
};
var syncProposalDirectly = async (database, proposalId, userId, customCenterUrl) => {
  const exportResult = await exportProposalIntegration(database, proposalId, userId, false);
  const { envelope, eventId } = exportResult;
  const centerUrl = customCenterUrl || process.env.CENTRO_CUSTOS_API_URL || DEFAULT_CENTER_URL;
  const integrationKey = resolveIntegrationKey();
  if (!integrationKey) {
    const errorMsg = "Integra\xE7\xE3o com o Centro de Custos n\xE3o configurada neste servidor.";
    await database.query(
      `UPDATE integration_outbox
       SET last_error = $2
       WHERE id = $1`,
      [eventId, errorMsg]
    );
    return { ok: false, status: "failed", error: errorMsg, centerUrl };
  }
  try {
    const response = await fetch(centerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Construtec-Integration-Key": integrationKey
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(6e3)
    });
    const responseBody = await response.json().catch(() => ({}));
    const validReceipt = responseBody.ok === true && ["imported", "already_imported"].includes(responseBody.status) && responseBody.contractId && responseBody.costCenterId && responseBody.baselineId;
    if (!response.ok || !validReceipt) {
      const errorMsg = responseBody.erro || responseBody.message || `Erro HTTP ${response.status} ao sincronizar com Centro de Custos`;
      await database.query(
        `UPDATE integration_outbox
         SET attempts = attempts + 1, last_error = $2
         WHERE id = $1`,
        [eventId, errorMsg]
      );
      return {
        ok: false,
        status: "failed",
        error: errorMsg,
        centerUrl
      };
    }
    const isDuplicate = responseBody.status === "already_imported" || Boolean(responseBody.isDuplicate);
    const p = envelope.payload?.proposal;
    const resolvedCenterUrl = new URL("/", centerUrl).href;
    await database.query(
      `UPDATE integration_outbox
       SET attempts = attempts + 1, delivered_at = now(), status = 'delivered', last_error = NULL,
         cost_center_id = $2, contract_id = $3, center_url = $4
       WHERE id = $1`,
      [eventId, responseBody.costCenterId ?? null, responseBody.contractId ?? null, resolvedCenterUrl]
    );
    return {
      ok: true,
      status: isDuplicate ? "already_imported" : "imported",
      isDuplicate,
      contractId: responseBody.contractId,
      costCenterId: responseBody.costCenterId,
      baselineId: responseBody.baselineId,
      proposalNumber: p?.number,
      revision: p?.revision,
      message: isDuplicate ? "Esta revis\xE3o j\xE1 estava integrada e vigente no Centro de Custos." : "Proposta sincronizada com sucesso no Centro de Custos.",
      centerUrl: resolvedCenterUrl
    };
  } catch (err) {
    const error = err;
    const isOffline = error?.code === "ECONNREFUSED" || error?.name === "TimeoutError" || error?.message?.includes("fetch failed") || error?.message?.includes("network");
    const errorMsg = isOffline ? "N\xE3o foi poss\xEDvel conectar ao Centro de Custos. Verifique a conex\xE3o e tente novamente." : error?.message || "Falha na comunica\xE7\xE3o direta";
    await database.query(
      `UPDATE integration_outbox
       SET attempts = attempts + 1, last_error = $2
       WHERE id = $1`,
      [eventId, errorMsg]
    );
    return {
      ok: false,
      status: isOffline ? "offline" : "failed",
      offline: isOffline,
      error: errorMsg,
      centerUrl
    };
  }
};

// src/server/routes/proposals.ts
var idSchema4 = import_zod6.z.string().uuid();
var addItemSchema = import_zod6.z.object({ productId: import_zod6.z.string().uuid(), quantity: import_zod6.z.number().positive().max(1e6).default(1) });
var removeItemsSchema = import_zod6.z.object({ itemIds: import_zod6.z.array(import_zod6.z.string().uuid()).min(1).max(500) });
var batchImportSchema = import_zod6.z.object({
  items: import_zod6.z.array(import_zod6.z.object({
    code: import_zod6.z.string().trim().max(80).optional(),
    description: import_zod6.z.string().trim().min(2).max(500),
    category: import_zod6.z.string().trim().max(120).optional(),
    unit: import_zod6.z.string().trim().max(20).optional(),
    quantity: import_zod6.z.number().positive().max(1e6),
    unitCost: import_zod6.z.number().nonnegative().max(1e8).optional(),
    unitSale: import_zod6.z.number().nonnegative().max(1e8).optional()
  })).min(1).max(2e3)
});
var copyProposalItemsSchema = import_zod6.z.object({
  sourceProposalId: import_zod6.z.string().uuid(),
  itemIds: import_zod6.z.array(import_zod6.z.string().uuid()).optional()
});
var updateItemSchema = import_zod6.z.object({
  description: import_zod6.z.string().trim().min(2).max(240).optional(),
  category: import_zod6.z.string().trim().min(2).max(80).optional(),
  quantity: import_zod6.z.number().positive().max(1e6).optional(),
  unit: import_zod6.z.string().trim().min(1).max(24).optional(),
  unitCost: import_zod6.z.number().min(0).max(1e8).optional(),
  unitSale: import_zod6.z.number().min(0).max(1e8).optional()
}).refine((input) => Object.keys(input).length > 0, { message: "Informe ao menos um campo para atualizar." });
var moveItemSchema = import_zod6.z.object({ direction: import_zod6.z.enum(["up", "down"]) });
var updateBdiSchema = import_zod6.z.object({ bdiMultiplier: import_zod6.z.number().positive().max(100) });
var updateTaxSchema = import_zod6.z.object({ taxPercentage: import_zod6.z.number().min(0).max(100) });
var updateContextSchema = import_zod6.z.object({ clientId: import_zod6.z.string().uuid(), workId: import_zod6.z.string().uuid() });
var updateDetailsSchema = import_zod6.z.object({
  scope: import_zod6.z.string().trim().min(3).max(1200).optional(),
  validUntil: import_zod6.z.iso.date().nullable().optional()
}).refine((input) => Object.keys(input).length > 0, { message: "Informe ao menos um campo para atualizar." });
var createProposalSchema = import_zod6.z.object({
  clientId: import_zod6.z.string().uuid(),
  workId: import_zod6.z.string().uuid(),
  scope: import_zod6.z.string().trim().min(3).max(1200),
  validUntil: import_zod6.z.iso.date().nullable().optional()
});
var laborSchema = import_zod6.z.object({
  description: import_zod6.z.string().trim().min(2).max(160),
  professionalCount: import_zod6.z.number().positive().max(1e3),
  monthlySalary: import_zod6.z.number().min(0).max(1e8),
  monthlyFood: import_zod6.z.number().min(0).max(1e8),
  monthlyTransport: import_zod6.z.number().min(0).max(1e8),
  monthlyOtherCosts: import_zod6.z.number().min(0).max(1e8),
  standardMonthlyHours: import_zod6.z.number().positive().max(1e3),
  plannedHours: import_zod6.z.number().min(0).max(1e6)
});
var standardHoursSchema = import_zod6.z.object({ standardMonthlyHours: import_zod6.z.number().positive().max(1e3) });
var statusSchema = import_zod6.z.object({
  status: import_zod6.z.enum(["draft", "review", "sent", "approved", "rejected"])
});
var cloneProposalSchema = import_zod6.z.object({
  clientId: import_zod6.z.string().uuid().optional(),
  workId: import_zod6.z.string().uuid().optional(),
  scope: import_zod6.z.string().trim().min(3).max(1200).optional()
}).optional();
var actor3 = (response) => {
  const user = response.locals.authUser;
  if (!user) throw new Error("AUTH_INVALID_CREDENTIALS");
  return user;
};
var createProposalsRouter = (database) => {
  const router = (0, import_express7.Router)();
  router.get("/current", async (_request, response, next) => {
    try {
      const proposal = await getCurrentProposal(database);
      if (!proposal) {
        response.status(404).json({ error: "Nenhuma proposta dispon\xEDvel." });
        return;
      }
      response.json({ proposal });
    } catch (error) {
      next(error);
    }
  });
  router.get("/", async (_request, response, next) => {
    try {
      response.json({ proposals: await listCurrentProposals(database) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (request, response, next) => {
    try {
      const proposalId = await createProposal(database, createProposalSchema.parse(request.body));
      await attributeProposalCreation(database, proposalId, actor3(response).id, "created");
      response.status(201).json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/clone", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = cloneProposalSchema.parse(request.body);
      const newProposalId = await cloneProposal(database, proposalId, input, actor3(response).id);
      response.status(201).json({ proposal: await getProposalById(database, newProposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/:proposalId", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const mode = request.query.mode === "revision" ? "revision" : "all";
      const result = await deleteProposal(database, proposalId, mode);
      response.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/status", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const { status } = statusSchema.parse(request.body);
      const proposal = await updateProposalStatus(database, proposalId, status, actor3(response).id);
      response.json({ proposal });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:proposalId/history", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      response.json({ revisions: await listProposalHistory(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:proposalId/labor", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const [items, standardMonthlyHours] = await Promise.all([
        listProposalLaborItems(database, proposalId),
        getProposalStandardMonthlyHours(database, proposalId)
      ]);
      response.json({ items, standardMonthlyHours });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/labor", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      await createProposalLaborItem(database, proposalId, laborSchema.parse(request.body), actor3(response).id);
      const items = await listProposalLaborItems(database, proposalId);
      response.status(201).json({ items });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/labor/:itemId", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const itemId = idSchema4.parse(request.params.itemId);
      await updateProposalLaborItem(database, proposalId, itemId, laborSchema.parse(request.body), actor3(response).id);
      response.json({ items: await listProposalLaborItems(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/labor/:itemId/remove", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const itemId = idSchema4.parse(request.params.itemId);
      await removeProposalLaborItem(database, proposalId, itemId, actor3(response).id);
      response.json({ items: await listProposalLaborItems(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/labor-settings", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = standardHoursSchema.parse(request.body);
      await updateProposalStandardMonthlyHours(database, proposalId, input.standardMonthlyHours, actor3(response).id);
      response.json({ standardMonthlyHours: input.standardMonthlyHours });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:proposalId", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const proposal = await getProposalById(database, proposalId);
      if (!proposal) {
        response.status(404).json({ error: "Proposta n\xE3o encontrada." });
        return;
      }
      response.json({ proposal });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/revisions", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const newProposalId = await createRevision(database, proposalId, actor3(response).id);
      response.status(201).json({ proposal: await getProposalById(database, newProposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/items", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = addItemSchema.parse(request.body);
      await addProductToProposal(database, proposalId, input.productId, input.quantity);
      await attributeCreatedProposalItemAudit(database, actor3(response).id, proposalId, input.productId);
      response.status(201).json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/items/import-batch", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const { items } = batchImportSchema.parse(request.body);
      const proposal = await importProposalItemsBatch(database, proposalId, items, actor3(response).id);
      response.status(201).json({ proposal });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/items/copy-from-proposal", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const { sourceProposalId, itemIds } = copyProposalItemsSchema.parse(request.body);
      const proposal = await copyItemsFromProposal(database, proposalId, sourceProposalId, itemIds, actor3(response).id);
      response.status(201).json({ proposal });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/items/remove", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = removeItemsSchema.parse(request.body);
      await removeProposalItems(database, proposalId, input.itemIds);
      await attributeAuditEvent(database, actor3(response).id, "proposal", proposalId, "items_removed");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/items/:itemId", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const itemId = idSchema4.parse(request.params.itemId);
      const input = updateItemSchema.parse(request.body);
      await updateProposalItem(database, proposalId, itemId, input);
      await attributeAuditEvent(database, actor3(response).id, "proposal_item", itemId, "updated");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/items/:itemId/duplicate", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const itemId = idSchema4.parse(request.params.itemId);
      await duplicateProposalItem(database, proposalId, itemId);
      await attributeDuplicatedProposalItemAudit(database, actor3(response).id, proposalId, itemId);
      response.status(201).json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/items/:itemId/move", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const itemId = idSchema4.parse(request.params.itemId);
      const input = moveItemSchema.parse(request.body);
      await moveProposalItem(database, proposalId, itemId, input.direction);
      await attributeAuditEvent(database, actor3(response).id, "proposal_item", itemId, "moved");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/bdi", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = updateBdiSchema.parse(request.body);
      await updateProposalBdi(database, proposalId, input.bdiMultiplier);
      await attributeAuditEvent(database, actor3(response).id, "proposal", proposalId, "bdi_updated");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/tax", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = updateTaxSchema.parse(request.body);
      await updateProposalTax(database, proposalId, input.taxPercentage);
      await attributeAuditEvent(database, actor3(response).id, "proposal", proposalId, "tax_updated");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/details", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = updateDetailsSchema.parse(request.body);
      await updateProposalDetails(database, proposalId, input);
      await attributeAuditEvent(database, actor3(response).id, "proposal", proposalId, "details_updated");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:proposalId/context", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const input = updateContextSchema.parse(request.body);
      await updateProposalContext(database, proposalId, input.clientId, input.workId);
      await attributeAuditEvent(database, actor3(response).id, "proposal", proposalId, "context_updated");
      response.json({ proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/integration-export", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const result = await exportProposalIntegration(database, proposalId, actor3(response).id);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/direct-sync", async (request, response, next) => {
    try {
      const proposalId = idSchema4.parse(request.params.proposalId);
      const result = await syncProposalDirectly(database, proposalId, actor3(response).id);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/proposalTracking.ts
var import_express8 = require("express");
var import_zod7 = require("zod");

// src/server/services/integration/centerTracking.ts
var DEFAULT_CENTER_API = "https://centro-custos-api.construtec-reports.workers.dev";
var TIMEOUT_MS2 = 6e3;
var REFRESH_LIMIT = 20;
var centerBase = () => {
  const configured = process.env.CENTRO_CUSTOS_API_URL;
  return configured ? new URL("/", configured).href.replace(/\/+$/, "") : DEFAULT_CENTER_API;
};
var integratedContract = async (database, proposalId) => (await database.query(`
  SELECT io.contract_id, io.center_url
  FROM integration_outbox io
  JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
  WHERE s.proposal_id = $1 AND io.status = 'delivered' AND io.contract_id IS NOT NULL
  ORDER BY io.delivered_at DESC NULLS LAST
  LIMIT 1
`, [proposalId])).rows[0] ?? null;
var fetchSummary = async (contractId) => {
  const key = resolveIntegrationKey();
  if (!key) throw new Error("CENTER_TRACKING_NOT_CONFIGURED");
  const response = await fetch(`${centerBase()}/api/integracao/orcamentos/contratos/${encodeURIComponent(contractId)}/resumo`, {
    headers: { "X-Construtec-Integration-Key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS2)
  });
  if (!response.ok) throw new Error(`CENTER_TRACKING_HTTP_${response.status}`);
  return await response.json();
};
var fetchContractMovement = async (contractId) => {
  const key = resolveIntegrationKey();
  if (!key) return "unavailable";
  try {
    const response = await fetch(`${centerBase()}/api/integracao/orcamentos/contratos/${encodeURIComponent(contractId)}/resumo`, {
      headers: { "X-Construtec-Integration-Key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS2)
    });
    if (response.status === 404) return 0;
    if (!response.ok) return "unavailable";
    const summary = await response.json();
    return typeof summary.movementCount === "number" ? summary.movementCount : "unavailable";
  } catch {
    return "unavailable";
  }
};
var saveSnapshot = async (database, proposalId, contractId, summary) => {
  await database.query(`
    INSERT INTO proposal_center_snapshots (proposal_id, contract_id, payload, fetched_at)
    VALUES ($1, $2, $3::jsonb, now())
    ON CONFLICT (proposal_id) DO UPDATE SET contract_id = EXCLUDED.contract_id, payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at
  `, [proposalId, contractId, JSON.stringify(summary)]);
};
var lastSnapshot = async (database, proposalId) => (await database.query(
  "SELECT payload, fetched_at::text AS fetched_at FROM proposal_center_snapshots WHERE proposal_id = $1",
  [proposalId]
)).rows[0] ?? null;
var getCenterTracking = async (database, proposalId) => {
  const contract = await integratedContract(database, proposalId);
  if (!contract) return { integrated: false, summary: null, fetchedAt: null, stale: false, centerUrl: null };
  const centerUrl = contract.center_url;
  try {
    const summary = await fetchSummary(contract.contract_id);
    await saveSnapshot(database, proposalId, contract.contract_id, summary);
    return { integrated: true, summary, fetchedAt: (/* @__PURE__ */ new Date()).toISOString(), stale: false, centerUrl };
  } catch {
    const cached = await lastSnapshot(database, proposalId);
    return { integrated: true, summary: cached?.payload ?? null, fetchedAt: cached?.fetched_at ?? null, stale: true, centerUrl };
  }
};
var refreshCenterTracking = async (database) => {
  const rows = (await database.query(`
    SELECT DISTINCT s.proposal_id
    FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    LEFT JOIN proposal_center_snapshots pcs ON pcs.proposal_id = s.proposal_id
    WHERE io.status = 'delivered' AND io.contract_id IS NOT NULL
      AND COALESCE(pcs.payload->>'costCenterStatus', '') <> 'concluido'
    LIMIT ${REFRESH_LIMIT}
  `)).rows;
  let refreshed = 0;
  for (const row of rows) {
    const tracking = await getCenterTracking(database, row.proposal_id);
    if (!tracking.stale) refreshed += 1;
    else break;
  }
  return refreshed;
};

// src/server/routes/proposalTracking.ts
var idSchema5 = import_zod7.z.string().uuid();
var createProposalTrackingRouter = (database) => {
  const router = (0, import_express8.Router)();
  router.get("/:proposalId/center-tracking", async (request, response, next) => {
    try {
      response.json(await getCenterTracking(database, idSchema5.parse(request.params.proposalId)));
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/proposalPriceDrift.ts
var import_express9 = require("express");
var import_zod8 = require("zod");

// src/server/services/priceDrift.ts
var import_node_crypto13 = require("node:crypto");
var MIN_DIFF2 = 0.01;
var getProposalPriceDrift = async (database, proposalId, withCost) => {
  const proposal = await getProposalById(database, proposalId);
  if (!proposal) return null;
  const frozen = proposal.status !== "draft" || !proposal.isLatest;
  const base = {
    id: proposal.id,
    number: proposal.number,
    revision: proposal.revision,
    clientName: proposal.clientName,
    workName: proposal.workName,
    status: proposal.status,
    frozen
  };
  const finalBefore = proposal.totals.finalValue ?? 0;
  if (frozen) return { ...base, items: [], finalBefore, finalAfter: finalBefore, finalDelta: 0, ...withCost ? { costDelta: 0 } : {} };
  const factor = proposal.bdiMultiplier;
  const taxFactor = 1 + (proposal.taxPercentage ?? 0) / 100;
  const items = [];
  const costDeltas = [];
  for (const line of proposal.items) {
    const now = line.catalogCurrentCost;
    if (now === null || now === void 0 || Math.abs(now - line.unitCost) < MIN_DIFF2) continue;
    const costDelta = multiplyDecimal([sumDecimal([now, -line.unitCost]), line.quantity]);
    costDeltas.push(costDelta);
    items.push({
      id: line.id,
      code: line.code,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      changePercent: line.unitCost > 0 ? roundMoney((now / line.unitCost - 1) * 100) : 0,
      finalDelta: multiplyDecimal([costDelta, factor, taxFactor]),
      ...withCost ? { fromUnit: line.unitCost, toUnit: now, costDelta } : {}
    });
  }
  const materialsDelta = sumDecimal(costDeltas);
  const after = calculateProposalTotals(sumDecimal([proposal.totals.materials ?? 0, materialsDelta]), proposal.totals.labor ?? 0, proposal.bdiMultiplier, proposal.taxPercentage ?? 0);
  return {
    ...base,
    items,
    finalBefore,
    finalAfter: after.finalValue,
    finalDelta: sumDecimal([after.finalValue, -finalBefore]),
    ...withCost ? { costDelta: materialsDelta } : {}
  };
};
var listPriceDriftProposals = async (database, withCost) => {
  const ids = await database.query(`
    SELECT DISTINCT p.id, p.updated_at
    FROM proposals p
    JOIN proposal_items pi ON pi.proposal_id = p.id
    JOIN products pr ON pr.code = pi.snapshot_code AND pr.active = true
    WHERE p.status = 'draft'
      AND NOT EXISTS (SELECT 1 FROM proposals newer WHERE newer.proposal_number = p.proposal_number AND newer.revision > p.revision)
      AND abs(pr.current_cost - pi.snapshot_unit_cost) >= $1
    ORDER BY p.updated_at DESC
    LIMIT 50
  `, [MIN_DIFF2]);
  const out = [];
  for (const row of ids.rows) {
    const drift = await getProposalPriceDrift(database, row.id, withCost);
    if (drift && drift.items.length > 0) out.push(drift);
  }
  return out;
};
var applyProposalPriceDrift = async (database, proposalId, itemIds) => {
  const updated = await database.transaction(async (transaction) => {
    const proposal = await getEditableProposal(transaction, proposalId);
    if (proposal.status !== "draft") throw new Error("PROPOSAL_LOCKED");
    const rows = await transaction.query(`
      SELECT pi.id, pi.snapshot_unit_cost::text AS before, pr.current_cost::text AS after
      FROM proposal_items pi
      JOIN products pr ON pr.code = pi.snapshot_code AND pr.active = true
      WHERE pi.proposal_id = $1 AND abs(pr.current_cost - pi.snapshot_unit_cost) >= $2
        AND ($3::uuid[] IS NULL OR pi.id = ANY($3::uuid[]))
      FOR UPDATE OF pi
    `, [proposalId, MIN_DIFF2, itemIds && itemIds.length ? itemIds : null]);
    for (const row of rows.rows) {
      await transaction.query("UPDATE proposal_items SET snapshot_unit_cost = $3 WHERE proposal_id = $1 AND id = $2", [proposalId, row.id, row.after]);
    }
    if (rows.rows.length > 0) {
      await transaction.query("UPDATE proposals SET updated_at = now() WHERE id = $1", [proposalId]);
      await transaction.query(`
        INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data)
        VALUES ($1, 'proposal', $2, 'price_drift_applied', $3::jsonb, $4::jsonb)
      `, [
        (0, import_node_crypto13.randomUUID)(),
        proposalId,
        JSON.stringify(rows.rows.map((row) => ({ itemId: row.id, unitCost: Number(row.before) }))),
        JSON.stringify(rows.rows.map((row) => ({ itemId: row.id, unitCost: Number(row.after) })))
      ]);
    }
    return rows.rows.length;
  });
  return updated;
};

// src/server/routes/proposalPriceDrift.ts
var idSchema6 = import_zod8.z.string().uuid();
var applySchema = import_zod8.z.object({ itemIds: import_zod8.z.array(import_zod8.z.string().uuid()).max(500).optional() });
var createProposalPriceDriftRouter = (database) => {
  const router = (0, import_express9.Router)();
  const user = (response) => {
    const authUser = response.locals.authUser;
    if (!authUser) throw new Error("AUTH_INVALID_CREDENTIALS");
    return authUser;
  };
  router.get("/price-drift", async (_request, response, next) => {
    try {
      response.json({ proposals: await listPriceDriftProposals(database, hasPermission(user(response), "p10")) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:proposalId/price-drift", async (request, response, next) => {
    try {
      const drift = await getProposalPriceDrift(database, idSchema6.parse(request.params.proposalId), hasPermission(user(response), "p10"));
      if (!drift) {
        response.status(404).json({ error: "Proposta n\xE3o encontrada." });
        return;
      }
      response.json({ drift });
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/price-drift/apply", async (request, response, next) => {
    try {
      const proposalId = idSchema6.parse(request.params.proposalId);
      const input = applySchema.parse(request.body ?? {});
      const updated = await applyProposalPriceDrift(database, proposalId, input.itemIds);
      await attributeAuditEvent(database, user(response).id, "proposal", proposalId, "price_drift_applied");
      response.json({ updated, proposal: await getProposalById(database, proposalId) });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/proposalDocument.ts
var import_express10 = require("express");
var import_zod9 = require("zod");

// src/documents/proposalDocumentCommon.ts
var LINE = "D6E4E9";
var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
var quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
var date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
var emptyConditions = (scope = "") => ({
  scope: scope.trim() || "A definir",
  executionTerm: "",
  paymentTerms: "",
  warranty: "",
  notes: ""
});
var fieldFromLines = (lines, names) => {
  const prefixes = names.map((name) => `${name}:`.toLowerCase());
  const found = lines.find((line) => prefixes.some((prefix) => line.toLowerCase().startsWith(prefix)));
  return found ? found.slice(found.indexOf(":") + 1).trim() : "";
};
var parseCommercialConditions = (scope) => {
  try {
    const parsed = JSON.parse(scope);
    if (parsed && typeof parsed === "object" && typeof parsed.scope === "string") {
      return {
        scope: parsed.scope.trim() || "A definir",
        executionTerm: typeof parsed.executionTerm === "string" ? parsed.executionTerm.trim() : "",
        paymentTerms: typeof parsed.paymentTerms === "string" ? parsed.paymentTerms.trim() : "",
        warranty: typeof parsed.warranty === "string" ? parsed.warranty.trim() : "",
        notes: typeof parsed.notes === "string" ? parsed.notes.trim() : ""
      };
    }
  } catch {
    const lines = scope.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const lineScope = fieldFromLines(lines, ["escopo", "scope"]);
    if (lineScope) {
      return {
        scope: lineScope,
        executionTerm: fieldFromLines(lines, ["prazo", "prazo de execu\xE7\xE3o", "execu\xE7\xE3o"]),
        paymentTerms: fieldFromLines(lines, ["pagamento", "forma de pagamento"]),
        warranty: fieldFromLines(lines, ["garantia"]),
        notes: fieldFromLines(lines, ["observa\xE7\xF5es", "observacao", "observacoes", "notas"])
      };
    }
  }
  return emptyConditions(scope);
};
var escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
var documentTitle = (proposal) => `${proposal.number}-REV-${String(proposal.revision).padStart(2, "0")}`;
var roundMoney4 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
var commercialLaborTotal = (proposal) => {
  const laborCost = proposal.totals.labor ?? 0;
  return laborCost > 0 ? roundMoney4(laborCost * proposal.bdiMultiplier) : 0;
};
var groupItemsByCategory = (proposal) => {
  const grouped = /* @__PURE__ */ new Map();
  for (const item of proposal.items) {
    const key = (item.category ?? "Outros").trim() || "Outros";
    const existing = grouped.get(key);
    if (existing) existing.push(item);
    else grouped.set(key, [item]);
  }
  return [...grouped.entries()];
};

// src/assets/logoBase64.ts
var CONSTRUTEC_LOGO_BASE64 = "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";

// src/documents/proposalPresentation.ts
var proposalLogoBase64 = () => CONSTRUTEC_LOGO_BASE64;
var proposalPresentation = (proposal, settings, options) => {
  const conditions = parseCommercialConditions(proposal.scope);
  const financials = getProposalFinancials(proposal);
  const total = financials.finalValue;
  const taxPercentage = proposal.taxPercentage ?? 0;
  const taxAmount = financials.taxAmount ?? 0;
  const subtotalBeforeTax = Math.round((total - taxAmount + Number.EPSILON) * 100) / 100;
  const includeLabor = options?.includeLabor ?? true;
  const labor = includeLabor ? commercialLaborTotal(proposal) : 0;
  const materials = labor > 0 ? roundMoney4(subtotalBeforeTax - labor) : subtotalBeforeTax;
  const taxEntry = taxAmount > 0 ? [`Impostos (${String(taxPercentage).replace(".", ",")}%)`, money.format(taxAmount)] : null;
  const summary = labor > 0 ? [
    ["Valor dos materiais e equipamentos", money.format(materials)],
    ["Valor dos servi\xE7os t\xE9cnicos", money.format(labor)],
    ...taxEntry ? [taxEntry] : [],
    ["Valor total da proposta", money.format(total)]
  ] : [
    ["Subtotal dos itens e servi\xE7os", money.format(subtotalBeforeTax)],
    ...taxEntry ? [taxEntry] : [],
    ["Valor total da proposta", money.format(total)]
  ];
  const includeTerms = options?.includeCommercialTerms ?? true;
  const includeNotes = options?.includeNotes ?? true;
  const combinedNotes = [conditions.notes, options?.customNotes?.trim()].filter(Boolean).join("\n\n");
  const terms = includeTerms ? [
    ["Forma de pagamento", conditions.paymentTerms || "A combinar com o cliente"],
    ["Validade da proposta", proposal.validUntil ? date.format(/* @__PURE__ */ new Date(`${proposal.validUntil}T00:00:00Z`)) : "30 dias"],
    ["Prazo de execu\xE7\xE3o", conditions.executionTerm || "A combinar ap\xF3s o aceite da proposta"],
    ["Garantia", conditions.warranty || "Conforme normas t\xE9cnicas aplic\xE1veis"],
    ...includeNotes && combinedNotes ? [["Observa\xE7\xF5es", combinedNotes]] : []
  ] : includeNotes && combinedNotes ? [["Observa\xE7\xF5es", combinedNotes]] : [];
  const docNumber = settings?.document?.trim() || "32.992.946/0001-78";
  const address = settings?.address?.trim() || "Rua Metodio Coelho, 62, Ed. Cidadella Center I, Sala 112, Salvador/BA";
  const phone = settings?.phone?.trim() || "(71) 99294-1099";
  const email = settings?.email?.trim() || "supervisao@rcconstrutec.com.br";
  const contactParts = [address, phone ? `Contato: ${phone}` : "", email ? `E-mail: ${email}` : ""].filter(Boolean);
  return {
    conditions,
    summary,
    terms,
    labor,
    brand: settings?.tradeName?.trim() || "CONSTRUTEC",
    company: settings?.companyName?.trim() || "LAC CONSTRUTEC CONSTRUTORA EIRELI",
    cnpj: docNumber,
    address,
    phone,
    email,
    contact: contactParts.join(" \u2022 "),
    presentation: "A CONSTRUTEC atua no desenvolvimento de solu\xE7\xF5es de engenharia, projetos, automa\xE7\xE3o, el\xE9trica, combate a inc\xEAndio e infraestrutura tecnol\xF3gica. Apresentamos nossa proposta t\xE9cnica e comercial para atendimento ao escopo descrito a seguir."
  };
};

// src/documents/proposalDocx.ts
var import_docx2 = require("docx");

// src/documents/proposalDocxHeaderFooter.ts
var import_docx = require("docx");

// src/documents/proposalDocx.ts
var borderLine = { style: import_docx2.BorderStyle.SINGLE, size: 1, color: LINE };

// src/documents/proposalDocument.ts
var buildProposalHtml = (proposal, settings, options) => {
  const content = proposalPresentation(proposal, settings, options);
  const logo = proposalLogoBase64();
  let index = 0;
  const showCodes = options?.showProductCodes ?? true;
  const itemRow = (item) => `<tr>
    <td class="center">${++index}</td>
    <td>
      <span class="item-desc">${escapeHtml(item.description)}</span>
      ${showCodes && item.code ? `<small class="item-code">${escapeHtml(item.code)}</small>` : ""}
    </td>
    <td class="center">${escapeHtml(item.unit)}</td>
    <td class="number">${quantity.format(item.quantity)}</td>
    <td class="number">${money.format(item.unitSale)}</td>
    <td class="number bold">${money.format(item.totalSale)}</td>
  </tr>`;
  const groupByCategory = options?.groupByCategory ?? true;
  const groups = groupByCategory ? groupItemsByCategory(proposal).map(([category, items]) => {
    const rowsHtml = items.map(itemRow).join("");
    return `<tbody><tr class="category"><td colspan="6">${escapeHtml(category)}</td></tr>${rowsHtml}</tbody>`;
  }).join("") : proposal.items.length ? `<tbody>${proposal.items.map(itemRow).join("")}</tbody>` : "";
  const labor = content.labor > 0 ? `<tbody><tr class="category"><td colspan="6">M\xE3o de Obra e Servi\xE7os T\xE9cnicos</td></tr>
    <tr>
      <td class="center">${++index}</td>
      <td><span class="item-desc">Servi\xE7os t\xE9cnicos e operacionais conforme escopo da proposta.</span></td>
      <td class="center">vb</td>
      <td class="number">1</td>
      <td class="number">${money.format(content.labor)}</td>
      <td class="number bold">${money.format(content.labor)}</td>
    </tr></tbody>` : "";
  const tableBody = groups + labor || '<tbody><tr><td colspan="6" class="center muted">Nenhum item inclu\xEDdo nesta revis\xE3o.</td></tr></tbody>';
  const summary = content.summary.map(
    ([label, value], i) => `<tr class="${i === content.summary.length - 1 ? "grand-total" : ""}"><th>${escapeHtml(label)}</th><td class="number">${escapeHtml(value)}</td></tr>`
  ).join("");
  const terms = content.terms.map(([label, value]) => `<p class="term"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`).join("");
  const todayFormatted = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(/* @__PURE__ */ new Date());
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentTitle(proposal))}</title>
  <style>
    @page { size: A4; margin: 12mm 14mm 18mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #17252d; }
    body { font: 9.5pt Arial, Helvetica, sans-serif; line-height: 1.35; -webkit-font-smoothing: antialiased; }
    
    .timbrado-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #12A9D1; padding-bottom: 3.5mm; margin-bottom: 4mm; break-inside: avoid; page-break-inside: avoid; }
    .timbrado-left { display: flex; align-items: center; gap: 4mm; }
    .timbrado-logo { max-height: 15mm; max-width: 48mm; width: auto; height: auto; object-fit: contain; display: block; }
    .timbrado-company { font-size: 7.5pt; color: #485966; line-height: 1.3; }
    .timbrado-company-name { font-size: 8.5pt; font-weight: bold; color: #163d69; }
    .timbrado-right { text-align: right; font-size: 7.5pt; color: #52616b; line-height: 1.3; border-left: 2px solid #e1edf2; padding-left: 3.5mm; min-width: 38mm; }
    .timbrado-badge { font-size: 7pt; font-weight: bold; color: #12A9D1; letter-spacing: 0.8px; }
    .timbrado-doc-ref { font-size: 9.5pt; font-weight: bold; color: #163d69; margin: 1px 0; }
    
    .identity { margin-bottom: 4mm; background: #f4f9fb; border: 1px solid #d4e7ee; border-radius: 3px; padding: 2.5mm 3.5mm; break-inside: avoid; page-break-inside: avoid; }
    .identity-table { width: 100%; border-collapse: collapse; }
    .identity-table td { padding: 1mm 1.5mm; border: none; font-size: 8.5pt; color: #17252d; vertical-align: top; }
    
    h1 { margin: 3mm 0 2mm; text-align: center; font-size: 12pt; color: #163d69; letter-spacing: 0.5px; text-transform: uppercase; break-after: avoid; page-break-after: avoid; }
    h2 { margin: 3.5mm 0 1.5mm; font-size: 9pt; color: #163d69; text-transform: uppercase; border-bottom: 1px solid #e8f0f3; padding-bottom: 1mm; break-after: avoid; page-break-after: avoid; }
    
    p { margin: 0 0 2mm; orphans: 3; widows: 3; font-size: 8.5pt; }
    .lead { font-size: 8.5pt; color: #3b4d58; margin-bottom: 3mm; }
    .copy { white-space: pre-line; overflow-wrap: anywhere; }
    
    table.pricing { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 1.5mm; }
    thead { display: table-header-group; break-after: avoid; }
    th, td { padding: 1.8mm 1.5mm; border-bottom: 1px solid #d4e2e7; vertical-align: top; font-size: 8pt; overflow-wrap: anywhere; }
    thead th { background: #163d69; color: #fff; font-size: 7.5pt; text-align: left; font-weight: bold; border-bottom: 2px solid #12A9D1; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .category td { background: #eaf3f6; color: #163d69; font-weight: bold; padding: 1.5mm 2mm; font-size: 8pt; border-left: 3px solid #12A9D1; }
    .center { text-align: center; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .bold { font-weight: bold; }
    .item-desc { display: block; }
    .item-code { display: block; color: #60717a; font-size: 6.8pt; margin-top: 0.5mm; }
    .muted { color: #5D7480; }
    
    .summary { width: 100%; border-collapse: collapse; margin-top: 2.5mm; break-inside: avoid; page-break-inside: avoid; }
    .summary th { text-align: left; width: 70%; font-weight: normal; padding: 1.5mm 2mm; font-size: 8.5pt; border-bottom: 1px solid #e1edf2; }
    .summary td { width: 30%; padding: 1.5mm 2mm; font-size: 8.5pt; border-bottom: 1px solid #e1edf2; }
    .grand-total th, .grand-total td { background: #d9edf3; font-size: 9pt; font-weight: bold; color: #163d69; border-top: 1.5px solid #12A9D1; border-bottom: 2px solid #163d69; }
    
    .commercial-box { margin-top: 3.5mm; break-inside: avoid; page-break-inside: avoid; }
    .term { margin-bottom: 1.2mm; font-size: 8.5pt; }
    .closing { margin-top: 3mm; font-size: 8pt; color: #485966; }
    
    .document-footer { margin-top: 6mm; break-inside: avoid; page-break-inside: avoid; font-family: Arial, Helvetica, sans-serif; }
    .footer-line { height: 2px; background: #12A9D1; margin-bottom: 1.5mm; }
    .footer-top { display: flex; justify-content: flex-end; margin-bottom: 1mm; font-size: 7.5pt; color: #334155; }
    .footer-company { font-weight: bold; font-size: 7.5pt; color: #0f172a; margin-bottom: 1px; letter-spacing: 0.2px; }
    .footer-text { font-size: 6.8pt; color: #1e293b; line-height: 1.35; margin-bottom: 1px; }
    .footer-text b { font-weight: bold; color: #0f172a; }
    
    @media screen {
      body { max-width: 210mm; margin: 15px auto; padding: 14mm; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.12); border-radius: 3px; }
    }
    @media print {
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .document-footer { display: none; }
    }
  </style>
</head>
<body>
  <header class="timbrado-header">
    <div class="timbrado-left">
      <img class="timbrado-logo" src="data:image/png;base64,${logo}" alt="${escapeHtml(content.brand)}">
      <div class="timbrado-company">
        <div class="timbrado-company-name">${escapeHtml(content.company)}</div>
        ${content.cnpj ? `<div>CNPJ: ${escapeHtml(content.cnpj)}</div>` : ""}
        <div>Sede: ${escapeHtml(content.address)}</div>
        <div>Contato: ${escapeHtml(content.phone)} &bull; ${escapeHtml(content.email)}</div>
      </div>
    </div>
    <div class="timbrado-right">
      <div class="timbrado-badge">PROPOSTA COMERCIAL</div>
      <div class="timbrado-doc-ref">${escapeHtml(proposal.number)}</div>
      <div>Revis\xE3o ${String(proposal.revision).padStart(2, "0")}</div>
      <div>${todayFormatted}</div>
    </div>
  </header>

  <div class="identity">
    <table class="identity-table">
      <tr>
        <td style="width: 60%"><b>Cliente:</b> ${escapeHtml(proposal.clientName)}</td>
        <td style="width: 40%"><b>A/C:</b> ${escapeHtml(proposal.responsibleName || "\u2014")}</td>
      </tr>
      <tr>
        <td><b>Local / Obra:</b> ${escapeHtml(proposal.workName || "\u2014")}</td>
        <td><b>Refer\xEAncia:</b> ${escapeHtml(proposal.number)} | Rev. ${String(proposal.revision).padStart(2, "0")}</td>
      </tr>
      ${content.conditions.scope ? `<tr><td colspan="2"><b>Escopo:</b> ${escapeHtml(content.conditions.scope)}</td></tr>` : ""}
    </table>
  </div>

  <h1>PROPOSTA T\xC9CNICA COMERCIAL</h1>
  <p class="lead">Prezados Senhores,<br>Apresentamos nossa proposta t\xE9cnica e comercial para fornecimento de equipamentos, materiais e execu\xE7\xE3o dos servi\xE7os descritos a seguir.</p>

  <h2>Apresenta\xE7\xE3o \u2014 ${escapeHtml(content.brand)}</h2>
  <p>${escapeHtml(content.presentation)}</p>

  <h2>1. Composi\xE7\xE3o e Precifica\xE7\xE3o</h2>
  <table class="pricing">
    <colgroup>
      <col style="width: 7%">
      <col style="width: 45%">
      <col style="width: 8%">
      <col style="width: 10%">
      <col style="width: 15%">
      <col style="width: 15%">
    </colgroup>
    <thead>
      <tr>
        <th class="center">ITEM</th>
        <th>DESCRI\xC7\xC3O</th>
        <th class="center">UN.</th>
        <th class="number">QTD.</th>
        <th class="number">VALOR UNIT.</th>
        <th class="number">VALOR TOTAL</th>
      </tr>
    </thead>
    ${tableBody}
  </table>

  <table class="summary">
    <tbody>${summary}</tbody>
  </table>

  <section class="commercial-box">
    <h2>2. Condi\xE7\xF5es Comerciais</h2>
    ${terms}
    <p>Valores expressos em moeda corrente nacional (BRL).</p>
  </section>

  <p class="closing">Permanecemos \xE0 disposi\xE7\xE3o para quaisquer esclarecimentos t\xE9cnicos ou comerciais referentes a esta proposta.</p>

  <footer class="document-footer">
    <div class="footer-line"></div>
    <div class="footer-top"><span>P\xE1g. 1 / 1</span></div>
    <div class="footer-company">${escapeHtml(content.company)}</div>
    <div class="footer-text"><b>Sede:</b> ${escapeHtml(content.address)} &bull; Contato: ${escapeHtml(content.phone)}</div>
    <div class="footer-text"><b>E-mail:</b> ${escapeHtml(content.email)}</div>
  </footer>
</body>
</html>`;
};

// src/documents/proposalMobileDocument.ts
var flag = (value, fallback) => {
  if (value === void 0 || value === null || value === "") return fallback;
  return !["0", "false", "nao", "n\xE3o"].includes(String(value).toLowerCase());
};
var parseMobileDocumentChoices = (query) => ({
  model: query.modelo === "resumido" ? "resumido" : "completo",
  cover: flag(query.capa, true),
  terms: flag(query.condicoes, true),
  validity: flag(query.validade, true)
});
var mobileExportOptions = (choices) => ({
  format: "pdf",
  groupByCategory: true,
  showProductCodes: choices.model === "completo",
  includeLabor: true,
  includeCommercialTerms: choices.terms,
  includeNotes: choices.model === "completo"
});
var formatDate = (iso) => iso ? date.format(/* @__PURE__ */ new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "";
var buildMobileProposalHtml = (proposal, settings, choices) => {
  const html = buildProposalHtml(proposal, settings, mobileExportOptions(choices));
  const total = money.format(getProposalFinancials(proposal).finalValue);
  const validUntil = formatDate(proposal.validUntil);
  const validity = choices.validity && validUntil ? `<p class="m-validity">Proposta v\xE1lida at\xE9 ${escapeHtml(validUntil)}. Depois disso, os pre\xE7os dos equipamentos podem mudar.</p>` : "";
  const cover = choices.cover ? `<section class="m-cover">
        <p class="m-kicker">Proposta comercial</p>
        <h1>${escapeHtml(proposal.workName || proposal.clientName || "")}</h1>
        <p class="m-client">${escapeHtml(proposal.clientName || "")}</p>
        <table class="m-facts">
          <tr><td>Proposta</td><td>${escapeHtml(`${proposal.number} \xB7 REV ${String(proposal.revision || 0).padStart(2, "0")}`)}</td></tr>
          ${validUntil && choices.validity ? `<tr><td>V\xE1lida at\xE9</td><td>${escapeHtml(validUntil)}</td></tr>` : ""}
          ${proposal.responsibleName ? `<tr><td>Respons\xE1vel</td><td>${escapeHtml(proposal.responsibleName)}</td></tr>` : ""}
          <tr><td>Valor total</td><td><b>${escapeHtml(total)}</b></td></tr>
        </table>
      </section>` : "";
  const style = `<style>
    .m-cover{page-break-after:always;break-after:page;padding:60mm 0 0;font-family:Arial,Helvetica,sans-serif;color:#0b2530}
    .m-cover .m-kicker{margin:0;font-size:10pt;letter-spacing:.08em;text-transform:uppercase;color:#12a9d1;font-weight:bold}
    .m-cover h1{margin:6mm 0 2mm;font-size:24pt;color:#163d69}
    .m-cover .m-client{margin:0 0 12mm;font-size:13pt;color:#334155}
    .m-facts{border-collapse:collapse;font-size:11pt}.m-facts td{padding:2mm 8mm 2mm 0;border:none}
    .m-facts td:first-child{color:#52616b}
    .m-validity{margin:8mm 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#334155}
  </style>`;
  return html.replace("</head>", `${style}</head>`).replace(/<body([^>]*)>/, `<body$1>${cover}`).replace("</body>", `${validity}</body>`);
};

// src/server/routes/proposalDocument.ts
var idSchema7 = import_zod9.z.string().uuid();
var createProposalDocumentRouter = (database) => {
  const router = (0, import_express10.Router)();
  router.get("/:proposalId/document", async (request, response, next) => {
    try {
      const proposal = await getProposalById(database, idSchema7.parse(request.params.proposalId));
      if (!proposal) {
        response.status(404).json({ error: "Proposta n\xE3o encontrada." });
        return;
      }
      const html = buildMobileProposalHtml(proposal, await getAppSettings(database), parseMobileDocumentChoices(request.query));
      response.setHeader("Cache-Control", "no-store");
      response.type("html").send(html);
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/proposalDiscard.ts
var import_express11 = require("express");
var import_zod10 = require("zod");

// src/server/services/proposalDiscard.ts
var import_node_crypto14 = require("node:crypto");
var TABLES = ["proposals", "proposal_items", "proposal_labor_items", "proposal_approval_snapshots", "integration_outbox", "proposal_center_snapshots"];
var GUARDS = [
  ["proposals", "approved_proposal_guard"],
  ["proposal_items", "approved_material_guard"],
  ["proposal_labor_items", "approved_labor_guard"],
  ["proposal_approval_snapshots", "snapshot_immutable_guard"]
];
var setGuards = async (queries2, enable) => {
  for (const [table, trigger] of GUARDS) {
    const exists = await queries2.query("SELECT 1 FROM pg_trigger WHERE tgname = $1", [trigger]);
    if (exists.rows.length) await queries2.query(`ALTER TABLE ${table} ${enable ? "ENABLE" : "DISABLE"} TRIGGER ${trigger}`);
  }
};
var selectors = {
  proposals: "id = ANY($1::uuid[])",
  proposal_items: "proposal_id = ANY($1::uuid[])",
  proposal_labor_items: "proposal_id = ANY($1::uuid[])",
  proposal_approval_snapshots: "proposal_id = ANY($1::uuid[])",
  integration_outbox: "snapshot_id IN (SELECT id FROM proposal_approval_snapshots WHERE proposal_id = ANY($1::uuid[]))",
  proposal_center_snapshots: "proposal_id = ANY($1::uuid[])"
};
var assertCenterWithoutMovement = async (database, proposalIds) => {
  const contracts = await database.query(`
    SELECT DISTINCT io.contract_id FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    WHERE s.proposal_id = ANY($1::uuid[]) AND io.status = 'delivered' AND io.contract_id IS NOT NULL`, [proposalIds]);
  for (const { contract_id: contractId } of contracts.rows) {
    const movement = await fetchContractMovement(contractId);
    if (movement === "unavailable") throw new Error("DISCARD_CENTER_UNAVAILABLE");
    if (movement > 0) throw new Error("DISCARD_CENTER_HAS_MOVEMENT");
  }
};
var discardProposal = async (database, proposalId, input) => {
  const current = await database.query("SELECT proposal_number FROM proposals WHERE id = $1", [proposalId]);
  const number = current.rows[0]?.proposal_number;
  if (!number) throw new Error("PROPOSAL_NOT_FOUND");
  if (input.confirmNumber.trim().toUpperCase() !== number.toUpperCase()) throw new Error("DISCARD_CONFIRMATION");
  const ids = (await database.query("SELECT id FROM proposals WHERE proposal_number = $1", [number])).rows.map((row) => row.id);
  await assertCenterWithoutMovement(database, ids);
  const discardId = (0, import_node_crypto14.randomUUID)();
  await database.transaction(async (transaction) => {
    const payload = {};
    for (const table of TABLES) {
      const dumped = await transaction.query(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS rows FROM ${table} t WHERE ${selectors[table]}`,
        [ids]
      );
      payload[table] = dumped.rows[0].rows;
    }
    const head = payload.proposals[0] ?? {};
    await setGuards(transaction, false);
    for (const table of [...TABLES].reverse()) await transaction.query(`DELETE FROM ${table} WHERE ${selectors[table]}`, [ids]);
    await setGuards(transaction, true);
    await transaction.query(`
      INSERT INTO discarded_proposals (id, proposal_number, client_name, work_name, revision_count, had_approval, reason, payload, discarded_by, discarded_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`, [
      discardId,
      number,
      head.snapshot_client_name ?? null,
      head.snapshot_work_name ?? head.work_name ?? null,
      ids.length,
      payload.proposals.some((row) => row.status === "approved"),
      input.reason?.trim().slice(0, 300) || null,
      JSON.stringify(payload),
      input.actor.id,
      input.actor.name
    ]);
    await transaction.query(`INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'discarded', $3::jsonb, $4::jsonb, $5)`, [
      (0, import_node_crypto14.randomUUID)(),
      proposalId,
      JSON.stringify({ number, revisions: ids.length }),
      JSON.stringify({ discardId, reason: input.reason ?? null }),
      input.actor.id
    ]);
  });
  return { discardId, proposalNumber: number };
};
var listDiscardedProposals = async (database) => (await database.query(`
  SELECT id, proposal_number, client_name, work_name, revision_count, had_approval, reason, discarded_by_name,
    discarded_at::text AS discarded_at, restored_at::text AS restored_at, restored_by_name
  FROM discarded_proposals ORDER BY discarded_at DESC LIMIT 200`)).rows;
var restoreProposal = async (database, discardId, actor5) => {
  return database.transaction(async (transaction) => {
    const row = (await transaction.query(
      "SELECT proposal_number, payload, restored_at::text AS restored_at FROM discarded_proposals WHERE id = $1 FOR UPDATE",
      [discardId]
    )).rows[0];
    if (!row) throw new Error("DISCARD_NOT_FOUND");
    if (row.restored_at) throw new Error("DISCARD_ALREADY_RESTORED");
    const clash = await transaction.query("SELECT 1 FROM proposals WHERE proposal_number = $1 LIMIT 1", [row.proposal_number]);
    if (clash.rows.length) throw new Error("DISCARD_NUMBER_IN_USE");
    await setGuards(transaction, false);
    for (const table of TABLES) {
      const rows = row.payload[table] ?? [];
      if (!rows.length) continue;
      await transaction.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`, [JSON.stringify(rows)]);
    }
    await setGuards(transaction, true);
    await transaction.query("UPDATE discarded_proposals SET restored_at = now(), restored_by_name = $2 WHERE id = $1", [discardId, actor5.name]);
    const latest = row.payload.proposals.find((item) => item.is_latest === true) ?? row.payload.proposals[0];
    await transaction.query(`INSERT INTO audit_events (id, entity_type, entity_id, action, before_data, after_data, user_id)
      VALUES ($1, 'proposal', $2, 'restored', NULL, $3::jsonb, $4)`, [(0, import_node_crypto14.randomUUID)(), latest?.id ?? discardId, JSON.stringify({ discardId, number: row.proposal_number }), actor5.id]);
    return { proposalId: latest?.id ?? null, proposalNumber: row.proposal_number };
  });
};

// src/server/routes/proposalDiscard.ts
var idSchema8 = import_zod10.z.string().uuid();
var discardSchema = import_zod10.z.object({ confirmNumber: import_zod10.z.string().trim().min(1).max(40), reason: import_zod10.z.string().trim().max(300).optional() });
var createProposalDiscardRouter = (database) => {
  const router = (0, import_express11.Router)();
  const admin = (response) => {
    const user = response.locals.authUser;
    if (user.role !== "admin") {
      response.status(403).json({ error: "Apenas administradores podem descartar ou restaurar propostas." });
      return null;
    }
    return user;
  };
  router.get("/discarded", async (_request, response, next) => {
    try {
      if (!admin(response)) return;
      response.json({ discarded: await listDiscardedProposals(database) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/discarded/:discardId/restore", async (request, response, next) => {
    try {
      const user = admin(response);
      if (!user) return;
      response.json(await restoreProposal(database, idSchema8.parse(request.params.discardId), { id: user.id, name: user.name }));
    } catch (error) {
      next(error);
    }
  });
  router.post("/:proposalId/discard", async (request, response, next) => {
    try {
      const user = admin(response);
      if (!user) return;
      const input = discardSchema.parse(request.body);
      response.json(await discardProposal(database, idSchema8.parse(request.params.proposalId), { ...input, actor: { id: user.id, name: user.name } }));
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/settings.ts
var import_express12 = require("express");
var import_zod11 = require("zod");
var settingsUpdateSchema = import_zod11.z.object({
  companyName: import_zod11.z.string().trim().min(1).max(200).optional(),
  tradeName: import_zod11.z.string().trim().max(200).optional(),
  document: import_zod11.z.string().trim().max(50).optional(),
  phone: import_zod11.z.string().trim().max(50).optional(),
  email: import_zod11.z.string().trim().max(120).optional(),
  address: import_zod11.z.string().trim().max(300).optional(),
  defaultResponsible: import_zod11.z.string().trim().min(1).max(120).optional(),
  defaultBdi: import_zod11.z.number().min(1).max(10).optional(),
  defaultStandardHours: import_zod11.z.number().min(1).max(720).optional(),
  defaultValidityDays: import_zod11.z.number().min(1).max(365).optional(),
  defaultTaxPercentage: import_zod11.z.number().min(0).max(100).optional(),
  pdfShowLogo: import_zod11.z.boolean().optional(),
  pdfShowSignature: import_zod11.z.boolean().optional()
});
var createSettingsRouter = (database) => {
  const router = (0, import_express12.Router)();
  router.get("/", async (_request, response, next) => {
    try {
      const settings = await getAppSettings(database);
      response.json({ settings });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/", async (request, response, next) => {
    try {
      const input = settingsUpdateSchema.parse(request.body);
      const settings = await updateAppSettings(database, input);
      response.json({ settings });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/routes/system.ts
var import_express13 = require("express");
var createSystemRouter = (database) => {
  const router = (0, import_express13.Router)();
  router.get("/backup", async (_request, response, next) => {
    try {
      const dump = await database.dumpDataDir("gzip");
      const bytes = Buffer.from(await dump.arrayBuffer());
      response.setHeader("Content-Type", "application/gzip");
      response.setHeader("Content-Length", String(bytes.byteLength));
      response.setHeader("Cache-Control", "no-store");
      response.send(bytes);
    } catch (error) {
      if (error instanceof Error && error.message === "REMOTE_BACKUP_UNSUPPORTED") {
        response.status(501).json({ error: "Na nuvem, o backup \xE9 feito pelo PostgreSQL gerenciado (restaura\xE7\xE3o do Neon e dump di\xE1rio criptografado)." });
        return;
      }
      next(error);
    }
  });
  return router;
};

// src/server/routes/users.ts
var import_express14 = require("express");
var import_zod12 = require("zod");

// src/server/services/users.ts
var toUserRecord = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
  updatedAt: row.updated_at,
  centroAdmin: Boolean(row.centro_admin)
});
var liveUsers = async (database) => (await database.query(`
  SELECT id, name, email, role, active, updated_at::text AS updated_at, centro_user_id, centro_admin, local_role
  FROM users
  WHERE deleted_at IS NULL AND centro_user_id IS NOT NULL
  ORDER BY active DESC, lower(name), lower(email)
`)).rows;
var listUsers = async (database, token3) => {
  const remote = await centroListUsers(token3);
  for (const user of remote.users) await mirrorCentroUser(database, user);
  const remoteIds = new Set(remote.users.map((user) => user.id));
  const gone = (await liveUsers(database)).filter((row) => row.centro_user_id && !remoteIds.has(row.centro_user_id));
  await retireLocalUsers(database, gone.map((row) => row.id));
  return (await liveUsers(database)).map(toUserRecord);
};
var findTarget = async (database, userId) => {
  const result = await database.query(`
    SELECT id, name, email, role, active, updated_at::text AS updated_at, centro_user_id, centro_admin, local_role
    FROM users WHERE id::text = $1 AND deleted_at IS NULL LIMIT 1
  `, [userId]);
  const target = result.rows[0];
  if (!target) throw new Error("USER_NOT_FOUND");
  return target;
};
var assertKeepsAdmin = async (database, target) => {
  if (target.role !== "admin" || !target.active) return;
  const otherAdmins = await database.query(`
    SELECT count(*)::text AS count FROM users
    WHERE id <> $1 AND active = true AND role = 'admin' AND deleted_at IS NULL
  `, [target.id]);
  if (Number(otherAdmins.rows[0]?.count ?? 0) === 0) throw new Error("USER_LAST_ADMIN");
};
var createUser = async (database, token3, input) => {
  const created = await centroCreateUser(token3, { name: input.name.trim(), email: input.email.trim().toLowerCase(), password: input.password });
  const row = await mirrorCentroUser(database, created.user, input.role);
  return toUserRecord({ ...row, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
};
var updateUser = async (database, token3, actorUserId, userId, input) => {
  const target = await findTarget(database, userId);
  if (actorUserId === userId && (!input.active || input.role !== "admin")) throw new Error("USER_SELF_LOCKOUT");
  if (target.centro_admin && input.role !== "admin") throw new Error("USER_ROLE_FROM_CENTRO");
  if (!input.active || input.role !== "admin") await assertKeepsAdmin(database, target);
  if (input.active !== target.active) await centroSetUserStatus(token3, target.email, input.active, target.centro_user_id);
  const result = await database.query(`
    UPDATE users SET role = $2, active = $3, local_role = $4, updated_at = now()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, name, email, role, active, updated_at::text AS updated_at, centro_user_id, centro_admin, local_role
  `, [target.id, input.role, input.active, target.centro_admin ? target.local_role : input.role]);
  forgetCachedSessions();
  return toUserRecord(result.rows[0]);
};
var deleteUser = async (database, token3, actorUserId, userId) => {
  const target = await findTarget(database, userId);
  if (actorUserId === userId) throw new Error("USER_SELF_LOCKOUT");
  await assertKeepsAdmin(database, target);
  try {
    await centroDeleteUser(token3, target.email, target.centro_user_id);
  } catch (error) {
    if (!(error instanceof CentroIdentityError && error.status === 404)) throw error;
  }
  await retireLocalUsers(database, [target.id]);
  forgetCachedSessions();
};
var listAuthorizedEmails = async (token3) => (await centroListAuthorizedEmails(token3)).emails;
var authorizeEmail = (token3, email, note) => centroAuthorizeEmail(token3, email, note);
var revokeEmail = (token3, email) => centroRevokeEmail(token3, email);

// src/server/routes/users.ts
var roleSchema = import_zod12.z.enum(["admin", "commercial", "viewer"]);
var createSchema = import_zod12.z.object({
  name: import_zod12.z.string().trim().min(2).max(120),
  email: import_zod12.z.string().trim().email().max(254),
  role: roleSchema,
  password: import_zod12.z.string().min(10).max(128)
});
var updateSchema = import_zod12.z.object({
  role: roleSchema,
  active: import_zod12.z.boolean()
});
var emailSchema = import_zod12.z.object({
  email: import_zod12.z.string().trim().email().max(254),
  note: import_zod12.z.string().trim().max(200).optional()
});
var actor4 = (response) => {
  const user = response.locals.authUser;
  if (!user) throw new Error("AUTH_INVALID_CREDENTIALS");
  return user;
};
var token2 = (response) => response.locals.sessionToken || "";
var createUsersRouter = (database) => {
  const router = (0, import_express14.Router)();
  router.get("/", async (_request, response, next) => {
    try {
      response.json({ users: await listUsers(database, token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (request, response, next) => {
    try {
      const input = createSchema.parse(request.body);
      const user = await createUser(database, token2(response), input);
      response.status(201).json({ user, users: await listUsers(database, token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  router.patch("/:userId", async (request, response, next) => {
    try {
      const input = updateSchema.parse(request.body);
      const user = await updateUser(database, token2(response), actor4(response).id, request.params.userId, input);
      response.json({ user, users: await listUsers(database, token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  router.delete("/:userId", async (request, response, next) => {
    try {
      await deleteUser(database, token2(response), actor4(response).id, request.params.userId);
      response.json({ users: await listUsers(database, token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/authorized-emails/list", async (_request, response, next) => {
    try {
      response.json({ emails: await listAuthorizedEmails(token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/authorized-emails", async (request, response, next) => {
    try {
      const input = emailSchema.parse(request.body);
      await authorizeEmail(token2(response), input.email.toLowerCase(), input.note || "");
      response.status(201).json({ emails: await listAuthorizedEmails(token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  router.post("/authorized-emails/revoke", async (request, response, next) => {
    try {
      const input = emailSchema.parse(request.body);
      await revokeEmail(token2(response), input.email.toLowerCase());
      response.json({ emails: await listAuthorizedEmails(token2(response)) });
    } catch (error) {
      next(error);
    }
  });
  return router;
};

// src/server/suiteGuard.ts
var COST_KEYS = /* @__PURE__ */ new Set([
  "unitCost",
  "totalCost",
  "baseCost",
  "cost",
  "materials",
  "labor",
  "additions",
  "grossResult",
  "marginPercent",
  "bdiMultiplier",
  "monthlyCost",
  "hourlyRate",
  "monthlySalary",
  "monthlyFood",
  "monthlyTransport",
  "monthlyOtherCosts",
  "catalogCurrentCost",
  "currentCost",
  "totalEstimatedCost",
  "defaultBdi"
]);
var maskCosts = (value) => {
  if (Array.isArray(value)) return value.map(maskCosts);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = COST_KEYS.has(key) && (typeof inner === "number" || inner === null) ? inner === null ? null : 0 : maskCosts(inner);
    }
    return out;
  }
  return value;
};
var deny = (response, error) => response.status(403).json({ error });
var maskJson = (response) => {
  const json = response.json.bind(response);
  response.json = ((body) => json(maskCosts(body)));
};
var suiteGuard = (request, response, next) => {
  const user = response.locals.authUser;
  const path3 = request.path.toLowerCase();
  if (user.apps && !user.apps.includes("orcamentos") && !path3.startsWith("/api/notifications")) {
    return deny(response, "Seu acesso n\xE3o inclui o Or\xE7amentos.");
  }
  const canSee = hasPermission(user, "p10");
  if (path3.startsWith("/api/catalog") || path3.startsWith("/api/kits")) {
    const appliesKit = /^\/api\/kits\/[^/]+\/apply-to-proposal$/.test(path3);
    if (!canSee && request.method !== "GET" && !appliesKit) return deny(response, "Seu papel n\xE3o permite alterar cat\xE1logo e kits, que carregam o custo.");
    if (!canSee) maskJson(response);
    return next();
  }
  if (path3.startsWith("/api/settings") && !canSee && request.method === "GET") maskJson(response);
  if (!path3.startsWith("/api/proposals")) return next();
  const write = request.method !== "GET";
  const action = /^\/api\/proposals\/[^/]+\/([^/]+)/.exec(path3)?.[1] ?? "";
  const status = String(request.body?.status ?? "");
  const canSend = hasPermission(user, "p11");
  if (!canSend) {
    const sends = request.method === "POST" && (action === "integration-export" || action === "direct-sync");
    const decides = request.method === "PATCH" && action === "status" && (status === "approved" || status === "sent");
    if (sends || decides) return deny(response, "Seu papel n\xE3o permite enviar ou aprovar propostas.");
  }
  if (!canSee) {
    const costWrite = write && ["bdi", "tax", "labor", "labor-settings"].includes(action);
    if (costWrite || action === "center-tracking") return deny(response, "Seu papel n\xE3o permite ver custo, BDI e margem.");
    maskJson(response);
  }
  return next();
};

// src/server/services/database.ts
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
var import_node_url = require("node:url");

// src/server/migrations/008-approved-proposal-guards.ts
var approvedProposalGuardsMigration = `
  CREATE OR REPLACE FUNCTION protect_approved_proposal() RETURNS trigger AS $$
  BEGIN
    IF OLD.status = 'approved' THEN
      IF TG_OP = 'DELETE' OR NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'PROPOSAL_LOCKED';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER approved_proposal_guard BEFORE UPDATE OR DELETE ON proposals
    FOR EACH ROW EXECUTE FUNCTION protect_approved_proposal();

  CREATE OR REPLACE FUNCTION protect_approved_proposal_line() RETURNS trigger AS $$
  DECLARE parent_id uuid; parent_status text;
  BEGIN
    -- Verifica ambos os pais: tamb\xE9m impede mover linha de/para proposta aprovada.
    FOR parent_id IN
      SELECT DISTINCT id FROM unnest(ARRAY[
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.proposal_id ELSE NULL END,
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.proposal_id ELSE NULL END
      ]) AS parents(id) WHERE id IS NOT NULL ORDER BY id
    LOOP
      SELECT status INTO parent_status FROM proposals WHERE id = parent_id FOR UPDATE;
      IF parent_status = 'approved' THEN RAISE EXCEPTION 'PROPOSAL_LOCKED'; END IF;
    END LOOP;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER approved_material_guard BEFORE INSERT OR UPDATE OR DELETE ON proposal_items
    FOR EACH ROW EXECUTE FUNCTION protect_approved_proposal_line();
  CREATE TRIGGER approved_labor_guard BEFORE INSERT OR UPDATE OR DELETE ON proposal_labor_items
    FOR EACH ROW EXECUTE FUNCTION protect_approved_proposal_line();
`;

// src/server/migrations/009-proposal-integration.ts
var proposalIntegrationMigration = `
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS series_id uuid;

  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'approved_proposal_guard') THEN
      ALTER TABLE proposals DISABLE TRIGGER approved_proposal_guard;
    END IF;
  END;
  $$;

  -- Backfill series_id determin\xEDstico para propostas existentes agrupadas por proposal_number
  UPDATE proposals p
  SET series_id = s.generated_series_id
  FROM (
    SELECT proposal_number, gen_random_uuid() AS generated_series_id
    FROM proposals
    WHERE series_id IS NULL
    GROUP BY proposal_number
  ) s
  WHERE p.proposal_number = s.proposal_number AND p.series_id IS NULL;

  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'approved_proposal_guard') THEN
      ALTER TABLE proposals ENABLE TRIGGER approved_proposal_guard;
    END IF;
  END;
  $$;

  ALTER TABLE proposals ALTER COLUMN series_id SET DEFAULT gen_random_uuid();
  ALTER TABLE proposals ALTER COLUMN series_id SET NOT NULL;

  CREATE TABLE IF NOT EXISTS proposal_approval_snapshots (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,
    series_id uuid NOT NULL,
    revision integer NOT NULL,
    payload jsonb NOT NULL,
    payload_sha256 text NOT NULL,
    sealed_at timestamptz NOT NULL DEFAULT now(),
    sealed_by uuid REFERENCES users(id),
    UNIQUE (proposal_id),
    UNIQUE (series_id, revision)
  );

  CREATE OR REPLACE FUNCTION protect_proposal_snapshot() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'SNAPSHOT_LOCKED';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER snapshot_immutable_guard BEFORE UPDATE OR DELETE ON proposal_approval_snapshots
    FOR EACH ROW EXECUTE FUNCTION protect_proposal_snapshot();

  CREATE TABLE IF NOT EXISTS integration_outbox (
    id uuid PRIMARY KEY,
    snapshot_id uuid NOT NULL REFERENCES proposal_approval_snapshots(id) ON DELETE RESTRICT,
    destination text NOT NULL DEFAULT 'centro-de-custos',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    UNIQUE (snapshot_id, destination)
  );

  CREATE INDEX IF NOT EXISTS idx_integration_outbox_status ON integration_outbox(status, created_at);
`;

// src/server/migrations/011-integration-outbox-result.ts
var integrationOutboxResultMigration = `
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS cost_center_id integer;
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS contract_id text;
  ALTER TABLE integration_outbox ADD COLUMN IF NOT EXISTS center_url text;
`;

// src/server/migrations/012-shared-identity.ts
var sharedIdentityMigration = `
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_user_id text;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_live_unique ON users (lower(email)) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS users_centro_user_id_unique ON users (centro_user_id) WHERE centro_user_id IS NOT NULL AND deleted_at IS NULL;
  UPDATE users SET password_hash = NULL, active = false, updated_at = now() WHERE centro_user_id IS NULL;
`;

// src/server/migrations/013-centro-admin.ts
var centroAdminMigration = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_admin boolean NOT NULL DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS local_role text;
  UPDATE users SET local_role = role WHERE centro_user_id IS NOT NULL AND local_role IS NULL;
`;

// src/server/migrations/014-proposal-center-snapshots.ts
var proposalCenterSnapshotsMigration = `
  CREATE TABLE IF NOT EXISTS proposal_center_snapshots (
    proposal_id uuid PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
    contract_id text NOT NULL,
    payload jsonb NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
  );
`;

// src/server/migrations/015-discarded-proposals.ts
var discardedProposalsMigration = `
  CREATE TABLE IF NOT EXISTS discarded_proposals (
    id uuid PRIMARY KEY,
    proposal_number text NOT NULL,
    client_name text,
    work_name text,
    revision_count integer NOT NULL DEFAULT 1,
    had_approval boolean NOT NULL DEFAULT false,
    reason text,
    payload jsonb NOT NULL,
    discarded_by uuid,
    discarded_by_name text,
    discarded_at timestamptz NOT NULL DEFAULT now(),
    restored_at timestamptz,
    restored_by_name text
  );
  CREATE INDEX IF NOT EXISTS idx_discarded_proposals_number ON discarded_proposals(proposal_number);
`;

// src/server/migrations/010-proposal-tax.ts
var proposalTaxMigration = `
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tax_percentage numeric(5, 2) NOT NULL DEFAULT 0;
`;

// src/server/migrations/001-initial.ts
var initialMigration = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'commercial', 'viewer')),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS clients (
    id uuid PRIMARY KEY,
    legal_name text NOT NULL,
    trade_name text,
    document text,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    manufacturer text,
    model text,
    description text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    current_cost numeric(14, 2) NOT NULL CHECK (current_cost >= 0),
    source text NOT NULL DEFAULT 'CONSTRUTEC',
    source_updated_at timestamptz,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id uuid PRIMARY KEY,
    proposal_number text NOT NULL,
    revision integer NOT NULL DEFAULT 0,
    client_id uuid NOT NULL REFERENCES clients(id),
    work_name text NOT NULL,
    scope text NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'review', 'sent', 'approved', 'rejected')),
    bdi_multiplier numeric(8, 4) NOT NULL DEFAULT 1,
    valid_until date,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proposal_number, revision)
  );

  CREATE TABLE IF NOT EXISTS proposal_items (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    catalog_product_id uuid REFERENCES products(id),
    position integer NOT NULL,
    snapshot_code text NOT NULL,
    snapshot_manufacturer text,
    snapshot_model text,
    snapshot_description text NOT NULL,
    snapshot_unit text NOT NULL,
    snapshot_unit_cost numeric(14, 2) NOT NULL CHECK (snapshot_unit_cost >= 0),
    quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
    sale_unit_price numeric(14, 2) NOT NULL CHECK (sale_unit_price >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, position)
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    before_data jsonb,
    after_data jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_products_search
    ON products (category, manufacturer, model);
  CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal
    ON proposal_items (proposal_id, position);
`;

// src/server/migrations/002-clients-works.ts
var clientsAndWorksMigration = `
  CREATE TABLE IF NOT EXISTS works (
    id uuid PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES clients(id),
    name text NOT NULL,
    address text,
    active boolean NOT NULL DEFAULT true,
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (client_id, name)
  );

  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES works(id);
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS snapshot_client_name text;
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS snapshot_work_name text;

  UPDATE proposals p
  SET snapshot_client_name = COALESCE(c.trade_name, c.legal_name),
      snapshot_work_name = p.work_name
  FROM clients c
  WHERE c.id = p.client_id
    AND (p.snapshot_client_name IS NULL OR p.snapshot_work_name IS NULL);

  CREATE INDEX IF NOT EXISTS idx_works_client ON works (client_id, active, name);
`;

// src/server/migrations/003-catalog-management.ts
var catalogManagementMigration = `
  ALTER TABLE products ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
  CREATE INDEX IF NOT EXISTS idx_products_active_search
    ON products (active, category, code);
`;

// src/server/migrations/004-clean-exsat-admin-ocr.ts
var cleanExsatAdministrativeOcrMigration = `
  DELETE FROM products product
  WHERE product.source ILIKE 'EXSAT COD.%'
    AND (
      product.description ILIKE '%construtec%'
      OR product.description ILIKE '%construtora%'
      OR product.description ILIKE '%engenharia%'
      OR product.description ILIKE '%ltda%'
      OR product.description ILIKE '%cnpj%'
      OR product.description ILIKE '%or\xE7amento%'
      OR product.description ILIKE '%orcamento%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM proposal_items item WHERE item.catalog_product_id = product.id
    );

  UPDATE products product
  SET active = false, updated_at = now()
  WHERE product.source ILIKE 'EXSAT COD.%'
    AND (
      product.description ILIKE '%construtec%'
      OR product.description ILIKE '%construtora%'
      OR product.description ILIKE '%engenharia%'
      OR product.description ILIKE '%ltda%'
      OR product.description ILIKE '%cnpj%'
      OR product.description ILIKE '%or\xE7amento%'
      OR product.description ILIKE '%orcamento%'
    )
    AND EXISTS (
      SELECT 1 FROM proposal_items item WHERE item.catalog_product_id = product.id
    );
`;

// src/server/migrations/005-proposal-labor.ts
var proposalLaborMigration = `
  ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS standard_monthly_hours numeric(10,2) NOT NULL DEFAULT 176;

  CREATE TABLE IF NOT EXISTS proposal_labor_items (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    position integer NOT NULL,
    description text NOT NULL,
    professional_count numeric(10,2) NOT NULL CHECK (professional_count > 0),
    monthly_salary numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
    monthly_food numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_food >= 0),
    monthly_transport numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_transport >= 0),
    monthly_other_costs numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_other_costs >= 0),
    standard_monthly_hours numeric(10,2) NOT NULL CHECK (standard_monthly_hours > 0),
    planned_hours numeric(12,2) NOT NULL CHECK (planned_hours >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS proposal_labor_items_proposal_idx
    ON proposal_labor_items(proposal_id, position);
`;

// src/server/migrations/006-proposal-item-category.ts
var proposalItemCategoryMigration = `
  ALTER TABLE proposal_items
    ADD COLUMN IF NOT EXISTS snapshot_category text NOT NULL DEFAULT 'Outros';
`;

// src/server/migrations/007-kits-and-settings.ts
var kitsAndSettingsMigration = `
  CREATE TABLE IF NOT EXISTS kits (
    id uuid PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    category text NOT NULL DEFAULT 'Geral',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS kit_items (
    id uuid PRIMARY KEY,
    kit_id uuid NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
    catalog_product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
    position integer NOT NULL,
    snapshot_code text NOT NULL,
    snapshot_description text NOT NULL,
    snapshot_unit text NOT NULL,
    quantity numeric(14, 4) NOT NULL CHECK (quantity > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (kit_id, position)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_kits_category ON kits (category, active, name);
  CREATE INDEX IF NOT EXISTS idx_kit_items_kit ON kit_items (kit_id, position);
`;

// src/server/services/bootstrap.ts
var import_node_crypto15 = require("node:crypto");
var import_bcryptjs = require("bcryptjs");
var demoUserId = "00000000-0000-4000-8000-000000000001";
var demoClientId = "00000000-0000-4000-8000-000000000002";
var demoProposalId = "00000000-0000-4000-8000-000000000003";
var demoWorkId = "00000000-0000-4000-8000-000000000004";
var demoProducts = [
  ["MAT-AC-001", "Controladora de acesso 2 portas TCP/IP", "Controle de acesso", "un", 1250],
  ["LEI-AC-002", "Leitor facial IP Wiegand", "Controle de acesso", "un", 1150],
  ["LEI-AC-003", "Leitor de cart\xE3o proximidade 13,56 MHz", "Controle de acesso", "un", 210],
  ["BTA-AC-004", "Botoeira de sa\xEDda inox", "Controle de acesso", "un", 65],
  ["FEC-AC-005", "Fechadura eletromagn\xE9tica 280 kgf", "Controle de acesso", "un", 320],
  ["FON-AC-006", "Fonte 12V 5A com nobreak", "Fontes", "un", 260],
  ["CAB-UTP-001", "Cabo de rede Cat.6 U/UTP 305m", "Cabeamento", "cx", 950],
  ["CAB-2P-001", "Cabo 2x18 AWG blindado", "Cabeamento", "m", 6.2],
  ["CON-DIN-001", "Conector RJ45 Cat.6", "Cabeamento", "un", 4.5],
  ["INF-ELE-001", "Eletroduto corrugado 3/4\u201D", "Infraestrutura", "m", 3.8],
  ["INF-CAI-001", "Caixa 4x2 de embutir", "Infraestrutura", "un", 2.6],
  ["SER-INST-001", "Instala\xE7\xE3o e configura\xE7\xE3o do sistema", "Servi\xE7os", "sv", 6800],
  ["SER-TRE-001", "Treinamento de usu\xE1rios (at\xE9 8h)", "Servi\xE7os", "sv", 350],
  ["SER-DOC-001", "Documenta\xE7\xE3o t\xE9cnica e as-built", "Servi\xE7os", "sv", 120],
  ["LEI-QR-004", "Leitor de QR Code para acesso", "Controle de acesso", "un", 485]
];
var quantities = [1, 2, 4, 2, 2, 2, 1, 100, 20, 50, 10, 1, 1, 1];
var ensureFirstRunData = async (database) => {
  const existing = await database.query("SELECT count(*)::text AS count FROM proposals");
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    const proposalsWithoutWork = await database.query(`
      SELECT p.id, p.client_id, p.work_name, p.snapshot_client_name
      FROM proposals p
      WHERE p.work_id IS NULL
      ORDER BY p.created_at
    `);
    for (const proposal of proposalsWithoutWork.rows) {
      const existingWork = await database.query(
        "SELECT id FROM works WHERE client_id = $1 AND name = $2 LIMIT 1",
        [proposal.client_id, proposal.work_name]
      );
      const workId = existingWork.rows[0]?.id ?? (0, import_node_crypto15.randomUUID)();
      if (!existingWork.rows[0]) {
        await database.query("INSERT INTO works (id, client_id, name) VALUES ($1, $2, $3)", [workId, proposal.client_id, proposal.work_name]);
      }
      await database.query(`
        UPDATE proposals p
        SET work_id = $2,
            snapshot_client_name = COALESCE(p.snapshot_client_name, COALESCE(c.trade_name, c.legal_name)),
            snapshot_work_name = COALESCE(p.snapshot_work_name, p.work_name)
        FROM clients c
        WHERE p.id = $1 AND c.id = p.client_id
      `, [proposal.id, workId]);
    }
    return;
  }
  const passwordHash = await (0, import_bcryptjs.hash)((0, import_node_crypto15.randomUUID)(), 12);
  await database.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') ON CONFLICT DO NOTHING`,
      [demoUserId, "Marcos Ribeiro", "marcos.demo@construtec.local", passwordHash]
    );
    await transaction.query(
      `INSERT INTO clients (id, legal_name, trade_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [demoClientId, "Edif\xEDcio Horizonte SPE Ltda.", "Edif\xEDcio Horizonte"]
    );
    await transaction.query(
      `INSERT INTO works (id, client_id, name, address)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [demoWorkId, demoClientId, "Edif\xEDcio Horizonte", "Endere\xE7o demonstrativo"]
    );
    for (const [index, product] of demoProducts.entries()) {
      const [code, description, category, unit, currentCost] = product;
      const productId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      await transaction.query(
        `INSERT INTO products (id, code, description, category, unit, current_cost, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'DEMONSTRA\xC7\xC3O') ON CONFLICT (code) DO NOTHING`,
        [productId, code, description, category, unit, currentCost]
      );
    }
    await transaction.query(
      `INSERT INTO proposals
        (id, proposal_number, revision, client_id, work_id, work_name, snapshot_client_name,
         snapshot_work_name, scope, status, bdi_multiplier, valid_until, created_by)
       VALUES ($1, 'PA-1054', 0, $2, $3, 'Edif\xEDcio Horizonte', 'Edif\xEDcio Horizonte',
         'Edif\xEDcio Horizonte', 'Controle de acesso', 'draft', 1.45, '2025-06-15', $4)`,
      [demoProposalId, demoClientId, demoWorkId, demoUserId]
    );
    for (const [index, quantity2] of quantities.entries()) {
      const [code, description, , unit, currentCost] = demoProducts[index];
      const productId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      await transaction.query(
        `INSERT INTO proposal_items
          (id, proposal_id, catalog_product_id, position, snapshot_code, snapshot_description,
           snapshot_unit, snapshot_unit_cost, quantity, sale_unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [(0, import_node_crypto15.randomUUID)(), demoProposalId, productId, index + 1, code, description, unit, currentCost, quantity2, Math.round(currentCost * 1.45 * 100) / 100]
      );
    }
  });
};

// src/server/services/database.ts
var loadPGlite = async (packagedModulePath) => {
  const pgliteSpecifier = packagedModulePath ? (0, import_node_url.pathToFileURL)(import_node_path.default.join(packagedModulePath, "dist", "index.js")).href : "@electric-sql/pglite";
  const nodeFsSpecifier = packagedModulePath ? (0, import_node_url.pathToFileURL)(import_node_path.default.join(packagedModulePath, "dist", "fs", "nodefs.js")).href : "@electric-sql/pglite/nodefs";
  const [pgliteModule, nodeFsModule] = await Promise.all([
    import(
      /* @vite-ignore */
      pgliteSpecifier
    ),
    import(
      /* @vite-ignore */
      nodeFsSpecifier
    )
  ]);
  return { PGlite: pgliteModule.PGlite, NodeFS: nodeFsModule.NodeFS };
};
var getDatabasePath = (userDataPath2) => import_node_path.default.join(userDataPath2, "data", "postgres");
var createDatabase = async (userDataPath2, packagedModulePath) => {
  if (process.env.DATABASE_URL) {
    const { createPostgresDatabase: createPostgresDatabase2 } = await Promise.resolve().then(() => (init_postgresDatabase(), postgresDatabase_exports));
    const database2 = createPostgresDatabase2(process.env.DATABASE_URL);
    try {
      await database2.transaction(async (transaction) => {
        await transaction.query("SELECT pg_advisory_xact_lock(178241, 1)");
        await migrateDatabase(transaction);
      });
      return database2;
    } catch (error) {
      await database2.close();
      throw error;
    }
  }
  const databasePath = getDatabasePath(userDataPath2);
  await (0, import_promises.mkdir)(databasePath, { recursive: true });
  try {
    await (0, import_promises.rm)(import_node_path.default.join(databasePath, "postmaster.pid"), { force: true });
  } catch {
  }
  const { PGlite, NodeFS } = await loadPGlite(packagedModulePath);
  const database = await PGlite.create({ fs: new NodeFS(databasePath) });
  try {
    await database.transaction(migrateDatabase);
    await ensureFirstRunData(database);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
};
var identityHealStatus = "pending";
var migrateDatabase = async (database) => {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const migrations = [
    [1, initialMigration],
    [2, clientsAndWorksMigration],
    [3, catalogManagementMigration],
    [4, cleanExsatAdministrativeOcrMigration],
    [5, proposalLaborMigration],
    [6, proposalItemCategoryMigration],
    [7, kitsAndSettingsMigration],
    [8, approvedProposalGuardsMigration],
    [9, proposalIntegrationMigration],
    [10, proposalTaxMigration],
    [11, integrationOutboxResultMigration],
    [12, sharedIdentityMigration],
    [13, centroAdminMigration],
    [14, proposalCenterSnapshotsMigration],
    [15, discardedProposalsMigration]
  ];
  for (const [version, sql] of migrations) {
    const result = await database.query(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [version]
    );
    if (result.rows.length === 0) {
      await database.exec(sql);
      await database.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    }
  }
  identityHealStatus = "ok";
  await database.exec("SAVEPOINT identity_heal");
  try {
    const identityColumns = await database.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = to_regclass('users'))
         AND table_name = 'users'`
    );
    const present = new Set(identityColumns.rows.map((row) => row.column_name));
    const missing = ["role", "centro_user_id", "deleted_at", "centro_admin", "local_role"].filter((column) => !present.has(column));
    if (missing.length) {
      await database.exec(`
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'commercial', 'viewer'));
        ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_user_id text;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS centro_admin boolean NOT NULL DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS local_role text;
      `);
      for (const column of ["password_salt", "password_iterations"]) {
        if (present.has(column)) await database.exec(`ALTER TABLE users ALTER COLUMN ${column} DROP NOT NULL`);
      }
      identityHealStatus = `healed:${missing.join(",")}`;
    }
    await database.exec("RELEASE SAVEPOINT identity_heal");
  } catch (error) {
    await database.exec("ROLLBACK TO SAVEPOINT identity_heal");
    const code = error.code;
    const target = /(?:column|relation) "([\w.]+)"/.exec(String(error?.message))?.[1] ?? "";
    identityHealStatus = `error:${typeof code === "string" ? code : "unknown"}${target ? `:${target}` : ""}`;
    console.error("[identity-heal]", error);
  }
  await database.exec("SAVEPOINT identity_indexes");
  try {
    await database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_live_unique ON users (lower(email)) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS users_centro_user_id_unique ON users (centro_user_id) WHERE centro_user_id IS NOT NULL AND deleted_at IS NULL;
    `);
    await database.exec("RELEASE SAVEPOINT identity_indexes");
  } catch (error) {
    await database.exec("ROLLBACK TO SAVEPOINT identity_indexes");
    identityHealStatus += `;index:${String(error.code ?? "unknown")}`;
    console.error("[identity-heal] indices", error);
  }
  await database.exec("ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS snapshot_category text NOT NULL DEFAULT 'Outros'");
  await database.exec("ALTER TABLE kits ALTER COLUMN description DROP NOT NULL");
};

// src/server/services/outboxRetryWorker.ts
var MAX_ATTEMPTS = 5;
var CRON_MAX_ATTEMPTS = 72;
var RETRY_INTERVAL_MS = 3e4;
var runOutboxRetryPass = async (database, maxAttempts = MAX_ATTEMPTS) => {
  const pending = await database.query(`
    SELECT io.id AS outbox_id, s.proposal_id, io.attempts
    FROM integration_outbox io
    JOIN proposal_approval_snapshots s ON s.id = io.snapshot_id
    WHERE io.status = 'pending' AND io.attempts < $1
    ORDER BY io.created_at ASC
    LIMIT 5
  `, [maxAttempts]);
  let attempted = 0;
  for (const row of pending.rows) {
    attempted += 1;
    const result = await syncProposalDirectly(database, row.proposal_id);
    if (result.status === "offline") break;
  }
  return attempted;
};
var runScheduledIntegrationPass = async (database, maxAttempts = MAX_ATTEMPTS) => ({
  attempted: await runOutboxRetryPass(database, maxAttempts),
  refreshed: await refreshCenterTracking(database)
});
var startOutboxRetryWorker = (database) => {
  return setInterval(async () => {
    try {
      await runOutboxRetryPass(database);
    } catch {
    }
  }, RETRY_INTERVAL_MS);
};

// src/server/createApp.ts
var getSessionToken = (request) => {
  const value = request.headers["x-construtec-session"];
  return typeof value === "string" ? value : "";
};
var MIN_SECRET_LENGTH = 32;
var ALLOWED_ORIGINS_ERROR = "CONSTRUTEC_ALLOWED_ORIGINS deve ser uma ou mais origens HTTPS v\xE1lidas, separadas por v\xEDrgula, sem caminho ou credenciais.";
var getCloudSecurity = (env = process.env) => {
  if (!env.DATABASE_URL) return void 0;
  const sessionSecret = env.SESSION_SECRET || "";
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET \xE9 obrigat\xF3rio e deve ter ao menos ${MIN_SECRET_LENGTH} caracteres no modo cloud.`);
  }
  const setupToken = env.CONSTRUTEC_SETUP_TOKEN || "";
  if (setupToken.length < MIN_SECRET_LENGTH) {
    throw new Error(`CONSTRUTEC_SETUP_TOKEN \xE9 obrigat\xF3rio e deve ter ao menos ${MIN_SECRET_LENGTH} caracteres no modo cloud.`);
  }
  const rawOrigins = (env.CONSTRUTEC_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (rawOrigins.length === 0) throw new Error(ALLOWED_ORIGINS_ERROR);
  const allowedOrigins = rawOrigins.map((raw) => {
    let origin;
    try {
      origin = new URL(raw);
    } catch {
      throw new Error(ALLOWED_ORIGINS_ERROR);
    }
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      throw new Error(ALLOWED_ORIGINS_ERROR);
    }
    return origin.origin;
  });
  return { sessionSecret, setupToken, allowedOrigins };
};
var CLOUD_SETUP_PATH = /^\/api\/auth\/setup\/?$/i;
var errorReference = (error) => {
  const code = error.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,40}$/.test(code) ? ` (c\xF3digo ${code})` : "";
};
var createApp = (database, apiToken) => {
  const api = (0, import_express15.default)();
  const cloud = getCloudSecurity();
  api.disable("x-powered-by");
  api.use((request, response, next) => {
    const origin = request.headers.origin;
    if (cloud) {
      if (origin && !cloud.allowedOrigins.includes(origin)) {
        response.status(403).json({ error: "Origem n\xE3o autorizada." });
        return;
      }
    } else {
      const isLocalOrPrivate = !origin || origin === "null" || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|[\w-]+\.local)(:\d+)?$/i.test(origin);
      if (origin && !isLocalOrPrivate) {
        response.status(403).json({ error: "Origem n\xE3o autorizada." });
        return;
      }
    }
    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Construtec-Session");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });
  api.use((request, response, next) => {
    if (cloud && CLOUD_SETUP_PATH.test(request.path) && request.headers.authorization !== `Bearer ${cloud.setupToken}`) {
      response.status(403).json({ error: "Configura\xE7\xE3o inicial protegida." });
      return;
    }
    next();
  });
  api.get("/health", async (_request, response) => {
    try {
      await database.query("SELECT now()::text AS now");
      response.json({ ok: true, storage: cloud ? "postgresql" : "local", identity: identityHealStatus });
    } catch {
      response.status(503).json({ ok: false, error: "Banco de dados indispon\xEDvel." });
    }
  });
  api.post("/internal/outbox/retry", async (request, response) => {
    const expected = cloud ? resolveIntegrationKey() : null;
    const provided = request.headers["x-construtec-integration-key"];
    const valid = typeof expected === "string" && typeof provided === "string" && provided.length === expected.length && (0, import_node_crypto16.timingSafeEqual)(Buffer.from(provided), Buffer.from(expected));
    if (!valid) {
      response.status(404).end();
      return;
    }
    try {
      response.json(await runScheduledIntegrationPass(database, CRON_MAX_ATTEMPTS));
    } catch {
      response.status(503).json({ error: "Reenvio indispon\xEDvel." });
    }
  });
  api.use((request, response, next) => {
    const isLocalApiToken = request.headers.authorization === `Bearer ${apiToken}`;
    const hasUserSession = Boolean(getSessionToken(request));
    const isPublicAuth = request.path.toLowerCase().startsWith("/api/auth");
    if (!isLocalApiToken && !hasUserSession && !isPublicAuth) {
      response.status(401).json({ error: "Sess\xE3o local inv\xE1lida." });
      return;
    }
    next();
  });
  api.use(import_express15.default.json({ limit: "1mb" }));
  api.get("/api/health", async (_request, response) => {
    const result = await database.query("SELECT now()::text AS now");
    response.json({ ok: true, storage: cloud ? "postgresql" : "local", databaseTime: result.rows[0]?.now });
  });
  api.use("/api/auth", createAuthRouter(database));
  api.use(async (request, response, next) => {
    let user;
    try {
      user = await verifyUserSession(database, getSessionToken(request));
    } catch (error) {
      next(error);
      return;
    }
    if (!user) {
      response.status(401).json({ error: "Sess\xE3o de usu\xE1rio inv\xE1lida ou expirada." });
      return;
    }
    response.locals.authUser = user;
    const path3 = request.path.toLowerCase();
    response.locals.sessionToken = getSessionToken(request);
    if (user.role === "viewer" && request.method !== "GET" && !path3.startsWith("/api/notifications")) {
      response.status(403).json({ error: "Seu perfil possui acesso somente para consulta." });
      return;
    }
    if (path3.startsWith("/api/users") && user.role !== "admin") {
      response.status(403).json({ error: "Apenas administradores podem gerenciar usu\xE1rios." });
      return;
    }
    if (path3.startsWith("/api/system") && user.role !== "admin") {
      response.status(403).json({ error: "Apenas administradores podem executar opera\xE7\xF5es de backup e restaura\xE7\xE3o." });
      return;
    }
    if (path3.startsWith("/api/settings") && request.method !== "GET" && user.role !== "admin") {
      response.status(403).json({ error: "Apenas administradores podem alterar as configura\xE7\xF5es." });
      return;
    }
    suiteGuard(request, response, next);
  });
  api.use("/api/catalog", createCatalogRouter(database));
  api.use("/api/clients", createClientsRouter(database));
  api.use("/api/proposals", createProposalDiscardRouter(database));
  api.use("/api/proposals", createProposalTrackingRouter(database));
  api.use("/api/proposals", createProposalPriceDriftRouter(database));
  api.use("/api/proposals", createProposalDocumentRouter(database));
  api.use("/api/proposals", createProposalsRouter(database));
  api.use("/api/kits", createKitsRouter(database));
  api.use("/api/settings", createSettingsRouter(database));
  api.use("/api/users", createUsersRouter(database));
  api.use("/api/system", createSystemRouter(database));
  api.use("/api/dashboard", createDashboardRouter(database));
  api.use("/api/notifications", createNotificationsRouter());
  api.use((error, _request, response, _next) => {
    void _next;
    if (error instanceof import_zod13.ZodError || error?.name === "ZodError" || Array.isArray(error?.issues)) {
      const issues = error.issues;
      const details = issues && issues.length > 0 ? issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join(", ") : "Dados inv\xE1lidos.";
      response.status(400).json({ error: `Dados inv\xE1lidos: ${details}` });
      return;
    }
    if (error instanceof CentroIdentityError) {
      const messages = {
        EMAIL_NOT_AUTHORIZED: "E-mail n\xE3o autorizado. Autorize o e-mail externo antes de criar a conta.",
        IDENTITY_UNAVAILABLE: error.message,
        IDENTITY_NOT_CONFIGURED: error.message
      };
      const status = [400, 401, 403, 404, 409, 429].includes(error.status) ? error.status : 503;
      response.status(status).json({ error: messages[error.code] || error.message });
      return;
    }
    if (error instanceof Error && error.message === "AUTH_HANDOFF_INVALID") {
      response.status(400).json({ error: "C\xF3digo de acesso do aplicativo inv\xE1lido ou expirado." });
      return;
    }
    if (error instanceof Error && error.message === "AUTH_INVALID_CREDENTIALS") {
      response.status(401).json({ error: "E-mail ou senha inv\xE1lidos." });
      return;
    }
    if (error instanceof Error && error.message === "AUTH_SETUP_COMPLETE") {
      response.status(409).json({ error: "O administrador inicial j\xE1 foi configurado." });
      return;
    }
    if (error instanceof Error && error.message === "USER_EMAIL_DUPLICATE") {
      response.status(409).json({ error: "J\xE1 existe um usu\xE1rio com esse e-mail." });
      return;
    }
    if (error instanceof Error && error.message === "USER_SELF_LOCKOUT") {
      response.status(409).json({ error: "Voc\xEA n\xE3o pode desativar ou remover o perfil administrativo da pr\xF3pria conta." });
      return;
    }
    if (error instanceof Error && error.message === "USER_ROLE_FROM_CENTRO") {
      response.status(409).json({ error: "Esta conta \xE9 administradora no Centro de Custos. O perfil dela s\xF3 muda l\xE1." });
      return;
    }
    if (error instanceof Error && error.message === "USER_LAST_ADMIN") {
      response.status(409).json({ error: "\xC9 necess\xE1rio manter pelo menos um administrador ativo." });
      return;
    }
    if (error instanceof Error && error.message.endsWith("_NOT_FOUND")) {
      response.status(404).json({ error: "Registro n\xE3o encontrado." });
      return;
    }
    if (error instanceof Error && error.message === "DISCARD_CONFIRMATION") {
      response.status(400).json({ error: "Digite o n\xFAmero da proposta exatamente como aparece para confirmar o descarte." });
      return;
    }
    if (error instanceof Error && error.message === "DISCARD_CENTER_HAS_MOVEMENT") {
      response.status(409).json({ error: "A obra desta proposta no Centro de Custos j\xE1 tem lan\xE7amentos, notas ou medi\xE7\xF5es. S\xF3 proposta sem movimento pode ser descartada." });
      return;
    }
    if (error instanceof Error && error.message === "DISCARD_CENTER_UNAVAILABLE") {
      response.status(503).json({ error: "N\xE3o foi poss\xEDvel conferir a obra no Centro de Custos agora. Tente de novo em instantes." });
      return;
    }
    if (error instanceof Error && error.message === "DISCARD_ALREADY_RESTORED") {
      response.status(409).json({ error: "Esta proposta j\xE1 foi restaurada." });
      return;
    }
    if (error instanceof Error && error.message === "DISCARD_NUMBER_IN_USE") {
      response.status(409).json({ error: "J\xE1 existe uma proposta com este n\xFAmero. Exclua ou renumere a existente antes de restaurar." });
      return;
    }
    if (error instanceof Error && error.message === "PROPOSAL_LOCKED") {
      response.status(409).json({ error: "Esta revis\xE3o est\xE1 bloqueada para altera\xE7\xF5es." });
      return;
    }
    if (error instanceof Error && error.message.startsWith("FINANCIAL_")) {
      response.status(422).json({ error: "Valor financeiro inv\xE1lido ou acima do limite suportado." });
      return;
    }
    if (error instanceof Error && error.message === "WORK_DUPLICATE") {
      response.status(409).json({ error: "J\xE1 existe uma obra com esse nome para o cliente." });
      return;
    }
    if (error instanceof Error && error.message === "PRODUCT_DUPLICATE") {
      response.status(409).json({ error: "J\xE1 existe um item com esse c\xF3digo no cat\xE1logo." });
      return;
    }
    if (error instanceof Error && (error.message === "KIT_NAME_DUPLICATE" || /unique constraint.*(?:kits_name|name)/i.test(error.message))) {
      response.status(409).json({ error: "J\xE1 existe um kit com esse nome." });
      return;
    }
    if (error instanceof Error && error.message === "KIT_EMPTY") {
      response.status(422).json({ error: "O kit selecionado n\xE3o possui itens." });
      return;
    }
    if (error instanceof Error && error.message === "EXSAT_URL_INVALID") {
      response.status(400).json({ error: "Use um endere\xE7o HTTPS do site exsat.com.br." });
      return;
    }
    if (error instanceof Error && error.message === "EXSAT_NO_PRODUCTS") {
      response.status(422).json({ error: "Nenhum produto foi identificado nessa p\xE1gina da Exsat." });
      return;
    }
    if (error instanceof Error && error.message === "EXSAT_UNAVAILABLE") {
      response.status(502).json({ error: "N\xE3o foi poss\xEDvel consultar a Exsat agora." });
      return;
    }
    if (error instanceof Error) {
      if (/violates not-null constraint/i.test(error.message)) {
        response.status(422).json({ error: "Preencha todos os campos obrigat\xF3rios." });
        return;
      }
      if (/violates foreign key constraint/i.test(error.message)) {
        response.status(422).json({ error: "Um dos produtos vinculados n\xE3o foi encontrado no cat\xE1logo." });
        return;
      }
      if (/duplicate key/i.test(error.message)) {
        response.status(409).json({ error: "Registro j\xE1 cadastrado com os mesmos dados." });
        return;
      }
      console.error(error);
      response.status(500).json({ error: cloud ? `N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o.${errorReference(error)}` : error.message || "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o local." });
      return;
    }
    console.error(error);
    response.status(500).json({ error: cloud ? "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o." : "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o local." });
  });
  return api;
};

// src/server/startApiServer.ts
var startApiServer = async (userDataPath2, packagedModulePath, preferredPort = Number(process.env.CONSTRUTEC_API_PORT || 5176)) => {
  const cloud = getCloudSecurity();
  const database = await createDatabase(userDataPath2, packagedModulePath);
  const token3 = process.env.CONSTRUTEC_API_TOKEN || (0, import_node_crypto17.randomUUID)();
  const api = createApp(database, token3);
  const server = await new Promise((resolve, reject) => {
    const host = process.env.CONSTRUTEC_API_HOST || "127.0.0.1";
    const bindServer = (port2) => {
      const instance = api.listen(port2, host, () => resolve(instance));
      instance.once("error", (err) => {
        if (err.code === "EADDRINUSE" && port2 !== 0 && !cloud) {
          bindServer(0);
        } else {
          reject(err);
        }
      });
    };
    bindServer(preferredPort);
  }).catch(async (error) => {
    await database.close();
    throw error;
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("N\xE3o foi poss\xEDvel iniciar a API local.");
  }
  const outboxWorker = startOutboxRetryWorker(database);
  return {
    url: `http://127.0.0.1:${address.port}`,
    token: token3,
    backup: async () => {
      const dump = await database.dumpDataDir("gzip");
      return new Uint8Array(await dump.arrayBuffer());
    },
    isAdminSession: async (sessionToken2) => {
      const user = await verifyUserSession(database, sessionToken2).catch(() => null);
      return user?.role === "admin";
    },
    close: async () => {
      clearInterval(outboxWorker);
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await database.close();
    }
  };
};

// scripts/start-api-isolated.ts
var userDataPath = (0, import_node_fs.mkdtempSync)(import_node_path2.default.join((0, import_node_os.tmpdir)(), "construtec-live-isolated-"));
var port = Number(process.env.CONSTRUTEC_API_PORT || 5176);
startApiServer(userDataPath, void 0, port).then((runtime) => {
  console.log(`[API Construtec ISOLATED] Servidor ativo em ${runtime.url}`);
  console.log(`[API Construtec ISOLATED] userDataPath: ${userDataPath}`);
}).catch((err) => {
  console.error("[API Construtec ISOLATED] Falha ao iniciar:", err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
