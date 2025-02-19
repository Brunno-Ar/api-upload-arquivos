const pool = require("./db");

async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Conexão bem-sucedida! Data/hora atual do PostgreSQL:", res.rows[0].now);
  } catch (err) {
    console.error("Erro ao conectar ao banco de dados:", err);
  } finally {
    pool.end();
  }
}

testConnection();
