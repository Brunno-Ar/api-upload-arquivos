const { Pool } = require("pg");

// Carrega o .env apenas em ambiente de desenvolvimento
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessário para conexões seguras
  },
});

module.exports = pool;