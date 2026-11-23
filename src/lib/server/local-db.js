import pg from 'pg';

const { Pool, types } = pg;

// Keep PostgreSQL DATE (OID 1082) as 'YYYY-MM-DD' string to match PostgREST output.
types.setTypeParser(1082, (val) => val);

const ALLOWED_TABLES = new Set([
  'departments',
  'profiles',
  'attendances',
  'settings',
  'holidays',
  'audit_logs',
  'user_devices',
  'notifications'
]);

const DATE_ONLY_COLUMNS = new Set(['work_date', 'holiday_date', 'join_date']);
const JSONB_COLUMNS = new Set(['detail', 'payload']);
const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/i;

function assertTable(table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Tabel tidak dikenali pada local database: ${table}`);
  }
}

function assertIdentifier(name) {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Identifier SQL tidak valid: ${name}`);
  }
  return name;
}

function resolveColumnRef(col) {
  if (col.includes('.')) {
    const [prefix, field] = col.split('.');
    assertIdentifier(field);
    if (prefix === 'profiles' || prefix === 'profile') {
      return `p.${field}`;
    }
    if (prefix === 'departments' || prefix === 'department') {
      return `d.${field}`;
    }
    throw new Error(`Relasi filter tidak didukung: ${col}`);
  }
  return `t.${assertIdentifier(col)}`;
}

function normalizeValue(key, value) {
  if (value instanceof Date) {
    if (DATE_ONLY_COLUMNS.has(key)) {
      return value.toISOString().slice(0, 10);
    }
    return value.toISOString();
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeValue(k, v);
    }
    return out;
  }
  return value;
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeValue(key, value);
  }
  return normalized;
}

function prepareParamValue(column, value) {
  if (value === undefined) return null;
  if (value !== null && JSONB_COLUMNS.has(column) && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Parses top-level columns from a PostgREST select string after removing nested relation segments.
 */
function parseTopLevelColumns(selectStr) {
  const stripped = (selectStr || '*')
    .replace(/[a-z_][a-z0-9_]*:[a-z_][a-z0-9_!]*\([^()]*(\([^()]*\)[^()]*)*\)/gi, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (stripped.length === 0 || stripped.includes('*')) {
    return 't.*';
  }
  return stripped.map((col) => `t.${assertIdentifier(col)}`).join(', ');
}

function buildSelectAndJoins(table, selectStr) {
  const raw = (selectStr || '*').trim();
  const baseCols = parseTopLevelColumns(raw);

  if (table === 'profiles' && raw.includes('department:departments')) {
    return {
      selectSql: `${baseCols}, CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('name', d.name) ELSE NULL END AS department`,
      joinSql: 'LEFT JOIN public.departments d ON d.id = t.department_id'
    };
  }

  if (table === 'attendances' && raw.includes('profile:profiles')) {
    const isInner = raw.includes('profiles!inner');
    const joinType = isInner ? 'INNER JOIN' : 'LEFT JOIN';
    return {
      selectSql: `${baseCols}, CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id', p.id, 'nip', p.nip, 'full_name', p.full_name, 'role', p.role, 'department_id', p.department_id, 'department', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id', d.id, 'name', d.name) ELSE NULL END) ELSE NULL END AS profile`,
      joinSql: `${joinType} public.profiles p ON p.id = t.user_id LEFT JOIN public.departments d ON d.id = p.department_id`
    };
  }

  if (table === 'audit_logs' && raw.includes('actor:profiles')) {
    return {
      selectSql: `${baseCols}, CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('nip', p.nip, 'full_name', p.full_name, 'role', p.role) ELSE NULL END AS actor`,
      joinSql: 'LEFT JOIN public.profiles p ON p.id = t.actor_id'
    };
  }

  return {
    selectSql: baseCols,
    joinSql: ''
  };
}

class LocalQueryBuilder {
  constructor(table, executeQuery, cache) {
    assertTable(table);
    this.table = table;
    this.executeQuery = executeQuery;
    this.cache = cache;
    this.operation = 'select';
    this.selectColumns = '*';
    this.countMode = null;
    this.headOnly = false;
    this.payload = null;
    this.filters = [];
    this.orders = [];
    this.limitVal = null;
    this.offsetVal = null;
    this.singleMode = null; // 'single' | 'maybeSingle'
  }

  select(columns = '*', options = {}) {
    if (this.operation === 'select') {
      this.selectColumns = columns || '*';
      this.countMode = options?.count || null;
      this.headOnly = Boolean(options?.head);
    } else {
      this.selectColumns = columns || '*';
    }
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'binary', op: '=', column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: 'binary', op: '<>', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'binary', op: '>=', column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: 'binary', op: '<=', column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: 'binary', op: '>', column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'binary', op: '<', column, value });
    return this;
  }

  ilike(column, value) {
    this.filters.push({ type: 'binary', op: 'ILIKE', column, value });
    return this;
  }

  is(column, value) {
    this.filters.push({ type: 'is', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, values: Array.isArray(values) ? values : [values] });
    return this;
  }

  or(expression) {
    if (expression && typeof expression === 'string') {
      this.filters.push({ type: 'or', expression });
    }
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orders.push({ column: assertIdentifier(column), direction: ascending ? 'ASC' : 'DESC' });
    return this;
  }

  limit(count) {
    this.limitVal = Math.max(0, Number(count) || 0);
    return this;
  }

  range(from, to) {
    const start = Math.max(0, Number(from) || 0);
    const end = Math.max(start, Number(to) || start);
    this.offsetVal = start;
    this.limitVal = end - start + 1;
    return this;
  }

  single() {
    this.singleMode = 'single';
    if (this.operation === 'select' && this.limitVal === null) {
      this.limitVal = 2;
    }
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    if (this.operation === 'select' && this.limitVal === null) {
      this.limitVal = 2;
    }
    return this;
  }

  buildWhereClause(params) {
    if (this.filters.length === 0) return '';
    const clauses = [];

    for (const filter of this.filters) {
      if (filter.type === 'binary') {
        params.push(filter.value);
        clauses.push(`${resolveColumnRef(filter.column)} ${filter.op} $${params.length}`);
      } else if (filter.type === 'is') {
        const colRef = resolveColumnRef(filter.column);
        if (filter.value === null) {
          clauses.push(`${colRef} IS NULL`);
        } else if (filter.value === true) {
          clauses.push(`${colRef} IS TRUE`);
        } else if (filter.value === false) {
          clauses.push(`${colRef} IS FALSE`);
        }
      } else if (filter.type === 'in') {
        params.push(filter.values);
        clauses.push(`${resolveColumnRef(filter.column)} = ANY($${params.length})`);
      } else if (filter.type === 'or') {
        const parts = filter.expression.split(',').map((p) => p.trim()).filter(Boolean);
        const orClauses = [];
        for (const part of parts) {
          const firstDot = part.indexOf('.');
          const secondDot = part.indexOf('.', firstDot + 1);
          if (firstDot === -1 || secondDot === -1) continue;
          const col = part.slice(0, firstDot);
          const op = part.slice(firstDot + 1, secondDot).toLowerCase();
          const rawVal = part.slice(secondDot + 1);
          const colRef = resolveColumnRef(col);

          if (op === 'is' && rawVal.toLowerCase() === 'null') {
            orClauses.push(`${colRef} IS NULL`);
          } else if (op === 'eq') {
            params.push(rawVal);
            orClauses.push(`${colRef} = $${params.length}`);
          } else if (op === 'ilike') {
            params.push(rawVal);
            orClauses.push(`${colRef} ILIKE $${params.length}`);
          }
        }
        if (orClauses.length > 0) {
          clauses.push(`(${orClauses.join(' OR ')})`);
        }
      }
    }

    return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  }

  getCacheKey() {
    if (this.operation !== 'select' || !this.cache || !this.cache.enabled) return null;
    if (!['settings', 'departments', 'profiles'].includes(this.table)) return null;
    return JSON.stringify({
      t: this.table,
      s: this.selectColumns,
      c: this.countMode,
      h: this.headOnly,
      f: this.filters,
      o: this.orders,
      l: this.limitVal,
      off: this.offsetVal,
      m: this.singleMode
    });
  }

  async execute() {
    try {
      if (this.operation === 'select') {
        return await this.executeSelect();
      }
      if (this.operation === 'insert') {
        return await this.executeInsert();
      }
      if (this.operation === 'update') {
        return await this.executeUpdate();
      }
      if (this.operation === 'delete') {
        return await this.executeDelete();
      }
      return { data: null, error: { message: `Operasi tidak didukung: ${this.operation}` } };
    } catch (err) {
      return {
        data: null,
        count: null,
        error: {
          message: err?.message || String(err),
          code: err?.code || 'DB_ERROR'
        }
      };
    }
  }

  async executeSelect() {
    const cacheKey = this.getCacheKey();
    if (cacheKey) {
      const cached = this.cache.get(this.table, cacheKey);
      if (cached) return cached;
    }

    const { selectSql, joinSql } = buildSelectAndJoins(this.table, this.selectColumns);
    const params = [];
    const whereSql = this.buildWhereClause(params);

    if (this.headOnly && this.countMode === 'exact') {
      const countSql = `SELECT COUNT(*)::int AS total_count FROM public.${this.table} t ${joinSql} ${whereSql}`;
      const res = await this.executeQuery(countSql, params);
      const count = Number(res.rows?.[0]?.total_count ?? 0);
      const output = { data: null, count, error: null };
      if (cacheKey) this.cache.set(this.table, cacheKey, output);
      return output;
    }

    let orderSql = '';
    if (this.orders.length > 0) {
      orderSql =
        'ORDER BY ' +
        this.orders.map((o) => `t.${o.column} ${o.direction}`).join(', ');
    }

    let limitOffsetSql = '';
    if (this.limitVal !== null) {
      params.push(this.limitVal);
      limitOffsetSql += ` LIMIT $${params.length}`;
    }
    if (this.offsetVal !== null) {
      params.push(this.offsetVal);
      limitOffsetSql += ` OFFSET $${params.length}`;
    }

    const dataSql = `SELECT ${selectSql} FROM public.${this.table} t ${joinSql} ${whereSql} ${orderSql} ${limitOffsetSql}`;

    let rows;
    let totalCount = null;

    if (this.countMode === 'exact') {
      const countParams = params.slice(0, params.length - (this.limitVal !== null ? 1 : 0) - (this.offsetVal !== null ? 1 : 0));
      const countSql = `SELECT COUNT(*)::int AS total_count FROM public.${this.table} t ${joinSql} ${whereSql}`;
      const [dataRes, countRes] = await Promise.all([
        this.executeQuery(dataSql, params),
        this.executeQuery(countSql, countParams)
      ]);
      rows = (dataRes.rows || []).map(normalizeRow);
      totalCount = Number(countRes.rows?.[0]?.total_count ?? rows.length);
    } else {
      const dataRes = await this.executeQuery(dataSql, params);
      rows = (dataRes.rows || []).map(normalizeRow);
    }

    const output = this.formatResult(rows, totalCount);
    if (cacheKey && !output.error) {
      this.cache.set(this.table, cacheKey, output);
    }
    return output;
  }

  async executeInsert() {
    const records = Array.isArray(this.payload) ? this.payload : [this.payload];
    if (records.length === 0 || !records[0]) {
      return { data: null, error: { message: 'Payload insert kosong.' } };
    }

    const columns = Object.keys(records[0]).filter((k) => records[0][k] !== undefined);
    columns.forEach(assertIdentifier);

    const params = [];
    const valueGroups = [];

    for (const record of records) {
      const placeholders = [];
      for (const col of columns) {
        params.push(prepareParamValue(col, record[col]));
        placeholders.push(`$${params.length}`);
      }
      valueGroups.push(`(${placeholders.join(', ')})`);
    }

    const sql = `INSERT INTO public.${this.table} (${columns.join(', ')}) VALUES ${valueGroups.join(', ')} RETURNING *`;
    const res = await this.executeQuery(sql, params);
    if (this.cache) this.cache.invalidate(this.table);
    const rows = (res.rows || []).map(normalizeRow);
    return this.formatResult(rows);
  }

  async executeUpdate() {
    if (!this.payload || typeof this.payload !== 'object') {
      return { data: null, error: { message: 'Payload update tidak valid.' } };
    }

    const entries = Object.entries(this.payload).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return { data: [], error: null };
    }

    const params = [];
    const setClauses = [];
    for (const [col, val] of entries) {
      assertIdentifier(col);
      params.push(prepareParamValue(col, val));
      setClauses.push(`${col} = $${params.length}`);
    }

    const whereSql = this.buildWhereClause(params);
    const sql = `UPDATE public.${this.table} t SET ${setClauses.join(', ')} ${whereSql} RETURNING *`;
    const res = await this.executeQuery(sql, params);
    if (this.cache) this.cache.invalidate(this.table);
    const rows = (res.rows || []).map(normalizeRow);
    return this.formatResult(rows);
  }

  async executeDelete() {
    const params = [];
    const whereSql = this.buildWhereClause(params);
    const sql = `DELETE FROM public.${this.table} t ${whereSql} RETURNING *`;
    const res = await this.executeQuery(sql, params);
    if (this.cache) this.cache.invalidate(this.table);
    const rows = (res.rows || []).map(normalizeRow);
    return this.formatResult(rows);
  }

  formatResult(rows, count = null) {
    if (this.singleMode === 'single') {
      if (rows.length !== 1) {
        return {
          data: null,
          count,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned'
          }
        };
      }
      return { data: rows[0], count, error: null };
    }

    if (this.singleMode === 'maybeSingle') {
      if (rows.length > 1) {
        return {
          data: null,
          count,
          error: {
            code: 'PGRST116',
            message: 'Multiple rows returned for maybeSingle'
          }
        };
      }
      return { data: rows[0] ?? null, count, error: null };
    }

    return { data: rows, count, error: null };
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class HotTableCache {
  constructor(ttlMs = 15000) {
    this.ttlMs = ttlMs;
    this.enabled = ttlMs > 0;
    this.store = new Map();
  }

  get(table, key) {
    if (!this.enabled) return null;
    const tableMap = this.store.get(table);
    if (!tableMap) return null;
    const entry = tableMap.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      tableMap.delete(key);
      return null;
    }
    return structuredClone(entry.value);
  }

  set(table, key, value) {
    if (!this.enabled) return;
    let tableMap = this.store.get(table);
    if (!tableMap) {
      tableMap = new Map();
      this.store.set(table, tableMap);
    }
    if (tableMap.size > 200) {
      const oldestKey = tableMap.keys().next().value;
      tableMap.delete(oldestKey);
    }
    tableMap.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  invalidate(table) {
    if (!table) {
      this.store.clear();
      return;
    }
    this.store.delete(table);
  }
}

/**
 * Creates a PostgREST-compatible local PostgreSQL database client (`from`, `rpc`, `query`, `invalidateCache`).
 * Accepts either a custom `queryFn(sql, params)` (e.g. PGlite in tests) or a `pg.Pool` / `databaseUrl`.
 */
export function createLocalDbClient({ queryFn, pool, databaseUrl, cacheTtlMs = 0 } = {}) {
  const activePool =
    pool ||
    (!queryFn && databaseUrl
      ? new Pool({
          connectionString: databaseUrl,
          max: Number(process.env.PG_POOL_MAX || 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 3000,
          statement_timeout: 10000
        })
      : null);

  const executeQuery =
    queryFn ||
    (async (sql, params) => {
      if (!activePool) {
        throw new Error('Local PostgreSQL pool belum dikonfigurasi (DATABASE_URL kosong).');
      }
      return activePool.query(sql, params);
    });

  const cache = new HotTableCache(cacheTtlMs);

  return {
    isLocalPg: true,
    pool: activePool,
    cache,
    invalidateCache(table) {
      cache.invalidate(table);
    },
    query: executeQuery,
    from(table) {
      return new LocalQueryBuilder(table, executeQuery, cache);
    },
    async rpc(fnName, args = {}) {
      try {
        assertIdentifier(fnName);
        if (fnName === 'rotate_administrator') {
          const params = [
            args.candidate_id ?? null,
            args.previous_role ?? 'admin_hr',
            Boolean(args.deactivate_previous)
          ];
          await executeQuery(
            'SELECT public.rotate_administrator($1::uuid, $2::public.user_role, $3::boolean)',
            params
          );
          cache.invalidate('profiles');
          cache.invalidate('audit_logs');
          return { data: null, error: null };
        }
        throw new Error(`RPC function tidak didukung pada local database: ${fnName}`);
      } catch (err) {
        return {
          data: null,
          error: {
            message: err?.message || String(err),
            code: err?.code || 'RPC_ERROR'
          }
        };
      }
    }
  };
}
