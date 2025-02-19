require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const pool = require("./db"); // Conexão com PostgreSQL
const { uploadFileToS3 } = require("./s3"); // Nosso módulo para S3

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Multer para armazenar os arquivos localmente (temporariamente)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Pasta onde os arquivos serão salvos temporariamente
  },
  filename: (req, file, cb) => {
    // Cria um nome único para o arquivo
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Rota para upload de arquivos
app.post("/upload", upload.any(), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Nenhum arquivo enviado!" });
  }

  const { filename, mimetype, size, path: localPath } = req.files[0];

  try {
    // Salvar metadados no PostgreSQL
    const query = `
      INSERT INTO uploads (filename, mimetype, size)
      VALUES ($1, $2, $3) RETURNING *;
    `;
    const values = [filename, mimetype, size];
    const result = await pool.query(query, values);

    // Upload do arquivo para o AWS S3
    const s3Key = filename; // Pode ser customizado conforme necessário
    const s3Result = await uploadFileToS3(localPath, s3Key);

    // Opcional: Remover o arquivo local após o upload para S3 (caso queira)
     const fs = require('fs');
     fs.unlinkSync(localPath);

    res.json({ 
      message: "Upload realizado com sucesso!", 
      file: result.rows[0],
      s3: s3Result,
    });
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({ error: "Erro ao processar o upload" });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
