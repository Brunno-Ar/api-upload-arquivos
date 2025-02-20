require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { Pool } = require("pg");
const { uploadFileToS3, deleteFileFromS3 } = require("./s3");

const app = express();
const port = process.env.PORT || 10000;

// Configuração do CORS
app.use(cors({
  origin: [
    "https://upload-files-frontend.vercel.app", // Domínio do frontend no Vercel
    "http://localhost:5173" // Domínio do frontend local
  ],
  methods: ["GET", "POST", "DELETE"], // Permitir os métodos necessários
  allowedHeaders: ["Content-Type"], // Permitir o header Content-Type
}));

// Middleware para logs
app.use((req, res, next) => {
  console.log(`Recebendo requisição: ${req.method} ${req.url}`);
  console.log("Cabeçalhos:", req.headers);
  next();
});

// Configuração do Multer para salvar arquivos temporariamente
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileName = req.body.fileName || Date.now();
    cb(null, fileName + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Configuração do Banco de Dados
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Criar tabela automaticamente ao iniciar o servidor
pool.query(`
  CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL
  );
`, (err, res) => {
  if (err) {
    console.error("Erro ao criar tabela:", err);
  } else {
    console.log("Tabela 'uploads' criada ou já existe.");
  }
});

// Rota para upload de arquivos
app.post("/upload", upload.any(), async (req, res) => {
  console.log("Recebendo requisição no backend!", req.body, req.files);

  if (!req.files || req.files.length === 0) {
    console.error("Nenhum arquivo enviado!");
    return res.status(400).json({ error: "Nenhum arquivo enviado!" });
  }

  const file = req.files[0];
  const fileName = req.body.fileName || file.filename;
  const { mimetype, size, path: localPath } = file;

  try {
    // Salvar no banco de dados
    console.log("Salvando no banco de dados...");
    const query = `
      INSERT INTO uploads (filename, mimetype, size)
      VALUES ($1, $2, $3) RETURNING *;
    `;
    const values = [fileName, mimetype, size];
    const result = await pool.query(query, values);
    console.log("Arquivo salvo no banco de dados:", result.rows[0]);

    // Enviar para o S3
    console.log("Enviando para o S3...");
    const s3Key = fileName;
    const s3Result = await uploadFileToS3(localPath, s3Key);
    console.log("Arquivo enviado para o S3:", s3Result);

    // Remover o arquivo local após o upload
    console.log("Removendo o arquivo local...");
    fs.unlinkSync(localPath);
    console.log("Arquivo local removido.");

    res.json({
      message: "Upload realizado com sucesso!",
      file: result.rows[0],
      s3Result,
    });
  } catch (error) {
    console.error("Erro ao processar o upload:", error);
    res.status(500).json({ error: "Erro ao processar o upload" });
  }
});

// Rota para listar arquivos
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
    console.log("Deletando do banco de dados...");
    const result = await pool.query(
      "DELETE FROM uploads WHERE filename = $1 RETURNING *",
      [filename]
    );

    if (result.rowCount === 0) {
      console.error("Arquivo não encontrado no banco de dados.");
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }
    console.log("Arquivo deletado do banco de dados:", result.rows[0]);

    // Deletar do S3
    console.log("Deletando do S3...");
    await deleteFileFromS3(filename);
    console.log("Arquivo deletado do S3.");

    res.json({ message: "Arquivo excluído com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir arquivo:", error);
    res.status(500).json({ error: "Erro ao excluir arquivo" });
  }
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});