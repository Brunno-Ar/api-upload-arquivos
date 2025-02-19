require("dotenv").config();
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const pool = require("./db");
const { uploadFileToS3, deleteFileFromS3 } = require("./s3");
const app = express();
const port = process.env.PORT || 5000; // Use a porta definida pelo Render ou 5000

// Configuração do CORS
app.use(cors({
  origin: "https://api-upload-arquivos.onrender.com", // Substitua pelo domínio do seu frontend
}));

// Middleware para lidar com JSON no corpo da requisição
app.use(express.json());

// Configuração do Multer para uploads de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const fileName = req.body.fileName || Date.now();
    cb(null, fileName + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Função para criar a tabela 'uploads' se ela não existir
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        size INTEGER NOT NULL
      );
    `);
    console.log("Tabela 'uploads' criada ou já existe.");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error);
  }
}

// Inicializa o banco de dados ao iniciar o servidor
initializeDatabase();

// Rota para upload de arquivos
app.post("/upload", upload.any(), async (req, res) => {
  console.log("Recebendo requisição no backend!", req.body, req.files);
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Nenhum arquivo enviado!" });
  }
  // Garantindo que fileName sempre tenha um valor válido
  const fileName = req.body.fileName || req.files[0].filename;
  const { mimetype, size, path: localPath } = req.files[0];
  try {
    const query = `
      INSERT INTO uploads (filename, mimetype, size)
      VALUES ($1, $2, $3) RETURNING *;
    `;
    const values = [fileName, mimetype, size];
    const result = await pool.query(query, values);
    const s3Key = fileName;
    const s3Result = await uploadFileToS3(localPath, s3Key);
    fs.unlinkSync(localPath);
    res.json({
      message: "Upload realizado com sucesso!",
      file: result.rows[0],
      s3Result,
    });
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({ error: "Erro ao processar o upload" });
  }
});

// Rota para listar os arquivos salvos no banco de dados
app.get("/files", async (req, res) => {
  try {
    const result = await pool.query("SELECT filename FROM uploads");
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar arquivos:", error);
    res.status(500).json({ error: "Erro ao listar arquivos" });
  }
});

// Rota para excluir arquivos
app.delete("/files/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    // Deletar do banco de dados
    const result = await pool.query("DELETE FROM uploads WHERE filename = $1 RETURNING *", [filename]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }
    // Deletar do S3
    await deleteFileFromS3(filename);
    res.json({ message: "Arquivo excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir arquivo:", error);
    res.status(500).json({ error: "Erro ao excluir arquivo" });
  }
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});