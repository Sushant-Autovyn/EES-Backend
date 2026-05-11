const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

pool.connect((err) => {
  if (err) {
    console.log('Database Connection Failed', err);
  } else {
    console.log('PostgreSQL Connected...');
  }
});

// MySQL-compatible wrapper for pg
const db = {
  query: (sql, paramsOrCallback, callback) => {
    let params = [];
    let cb = callback;
    if (typeof paramsOrCallback === 'function') {
      cb = paramsOrCallback;
    } else {
      params = paramsOrCallback || [];
    }

    // Convert ? placeholders to $1, $2, $3...
    let paramIndex = 0;
    let pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

    // Auto-add RETURNING id for INSERT statements
    const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
    if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql = pgSql.replace(/;?\s*$/, ' RETURNING id');
    }

    pool.query(pgSql, params, (err, result) => {
      if (err) {
        // Map PostgreSQL error codes to MySQL-like codes
        if (err.code === '23505') {
          err.code = 'ER_DUP_ENTRY';
        }
        return cb(err);
      }

      // PostgreSQL returns lowercase column names for aliases.
      // Restore original alias casing from the SQL (e.g. totalEmployees, not totalemployees).
      const aliasMap = {};
      const aliasRegex = /\bAS\s+(\w+)/gi;
      let match;
      while ((match = aliasRegex.exec(sql)) !== null) {
        aliasMap[match[1].toLowerCase()] = match[1];
      }

      const rows = result.rows.map(row => {
        if (Object.keys(aliasMap).length === 0) return row;
        const fixed = {};
        for (const key of Object.keys(row)) {
          const original = aliasMap[key.toLowerCase()];
          fixed[original || key] = row[key];
        }
        return fixed;
      });

      rows.affectedRows = result.rowCount;
      rows.insertId = result.rows[0]?.id;
      cb(null, rows);
    });
  }
};

module.exports = db;