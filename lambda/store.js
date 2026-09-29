// Persistence layer.
//
// All database access goes through this small interface so the payment logic
// never touches a client library directly. Two implementations:
//
//   - supabase (default): Postgres via Supabase, using the service_role key
//     resolved at runtime from Secrets Manager.
//   - memory: an in-process store for unit tests and local development.
//     Selected with DATA_STORE=memory and refused inside a real Lambda.
//
// Idempotency is enforced by the database, not by application checks:
// transactions has a UNIQUE (merchant_id, order_id) index (see
// supabase/schema.sql), and insertTransaction reports a conflict instead of
// creating a duplicate.

const { getSupabaseKey } = require("./secrets");

const UNIQUE_VIOLATION = "23505";

// --- Supabase ---------------------------------------------------------------
const createSupabaseStore = () => {
  let clientPromise = null;
  const db = () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        const url = process.env.SUPABASE_URL;
        if (!url) throw new Error("SUPABASE_URL must be set");
        const { createClient } = require("@supabase/supabase-js");
        return createClient(url, await getSupabaseKey(), {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      })().catch((err) => {
        clientPromise = null; // allow a retry on the next call
        throw err;
      });
    }
    return clientPromise;
  };

  const findTransaction = async (merchantId, orderId) => {
    const { data, error } = await (await db())
      .from("transactions")
      .select("*")
      .eq("merchant_id", merchantId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const countWhere = async (batchId, status) => {
    const { count, error } = await (await db())
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("status", status);
    if (error) throw error;
    return count || 0;
  };

  return {
    kind: "supabase",

    async insertTransaction(row) {
      const { data, error } = await (await db()).from("transactions").insert([row]).select().single();
      if (!error) return { inserted: true, row: data };
      if (error.code === UNIQUE_VIOLATION) {
        return { inserted: false, row: await findTransaction(row.merchant_id, row.order_id) };
      }
      throw error;
    },

    findTransaction,

    async listTransactions(limit, offset) {
      const { data, error } = await (await db())
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data || [];
    },

    async countBatchOutcomes(batchId) {
      const [approved, declined] = await Promise.all([
        countWhere(batchId, "APPROVED"),
        countWhere(batchId, "DECLINED"),
      ]);
      return { approved, declined };
    },

    async createBatch(row) {
      const { error } = await (await db()).from("batches").insert([row]);
      if (error) throw error;
    },

    async updateBatch(id, patch) {
      const { error } = await (await db())
        .from("batches")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    async getBatch(id) {
      const { data, error } = await (await db()).from("batches").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  };
};

// --- In-memory ---------------------------------------------------------------
const createMemoryStore = () => {
  const transactions = [];
  const batches = new Map();
  let nextId = 1;
  const copy = (v) => (v ? structuredClone(v) : v);

  const findTransaction = async (merchantId, orderId) =>
    copy(transactions.find((t) => t.merchant_id === merchantId && t.order_id === orderId) || null);

  return {
    kind: "memory",

    async insertTransaction(row) {
      const existing = await findTransaction(row.merchant_id, row.order_id);
      if (existing) return { inserted: false, row: existing };
      const stored = { id: nextId++, ...copy(row) };
      transactions.push(stored);
      return { inserted: true, row: copy(stored) };
    },

    findTransaction,

    async listTransactions(limit, offset) {
      return copy(
        [...transactions]
          .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
          .slice(offset, offset + limit)
      );
    },

    async countBatchOutcomes(batchId) {
      const rows = transactions.filter((t) => t.batch_id === batchId);
      return {
        approved: rows.filter((t) => t.status === "APPROVED").length,
        declined: rows.filter((t) => t.status === "DECLINED").length,
      };
    },

    async createBatch(row) {
      if (batches.has(row.id)) throw Object.assign(new Error("duplicate batch"), { code: UNIQUE_VIOLATION });
      batches.set(row.id, copy(row));
    },

    async updateBatch(id, patch) {
      if (batches.has(id)) {
        batches.set(id, { ...batches.get(id), ...copy(patch), updated_at: new Date().toISOString() });
      }
    },

    async getBatch(id) {
      return copy(batches.get(id) || null);
    },

    // Test helper only.
    _all: () => copy(transactions),
  };
};

// --- Selection ---------------------------------------------------------------
let store = null;

const getStore = () => {
  if (store) return store;
  if (process.env.DATA_STORE === "memory") {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error("DATA_STORE=memory is not allowed inside AWS Lambda");
    }
    store = createMemoryStore();
  } else {
    store = createSupabaseStore();
  }
  return store;
};

// Lets tests start from a clean store.
const resetStore = () => {
  store = null;
};

module.exports = { getStore, resetStore, createMemoryStore, UNIQUE_VIOLATION };
