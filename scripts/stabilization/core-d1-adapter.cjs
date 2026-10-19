/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local fixture adapter. */
exports.attach = function(h, target) {
  Object.assign(h.adapter, {
    query: async (sql, params=[]) => (await target.prepare(sql).bind(...params).all()).results,
    queryOne: async (sql, params=[]) => await target.prepare(sql).bind(...params).first(),
    execute: async (sql, params=[]) => { const r=await target.prepare(sql).bind(...params).run(); return {success:r.success}; },
    batch: async statements => { await target.batch(statements.map(s=>target.prepare(s.sql).bind(...(s.params||[])))); },
  });
};
