require("dotenv").config();
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const pool = require("./db");
const { uploadFileToS3, deleteFileFromS3 } = require("./s3");

const app = express();
const port = process.env.PORT || 10000;

// Cria o diretório 'uploads' se ele não existir
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configuração do CORS
app.use(cors({
  origin: [
    "https://upload-files-frontend.vercel.app", // Domínio do frontend no Vercel
    "http://localhost:5173" // Domínio do frontend local
  ],
  methods: ["GET", "POST", "DELETE"], // Permitir os métodos necessários
  allowedHeaders: ["Content-Type"], // Permitir o header Content-Type
}));

// Middleware para lidar com requisições OPTIONS
app.options("*", cors()); // Isso garante que todas as rotas respondam corretamente às requisições OPTIONS

app.use(express.json()); // Para lidar com JSON no corpo da requisição

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

// Criação da tabela 'uploads' automaticamente ao iniciar o servidor
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
    return res.status(400).json({ error: "Nenhum arquivo enviado!" });
  }

  // Garantindo que fileName sempre tenha um valor válido
  const fileName = req.body.fileName || req.files[0].filename;
  const { mimetype, size, path: localPath } = req.files[0];

  try {
    // Salvar no banco de dados
    const query = `
      INSERT INTO uploads (filename, mimetype, size)
      VALUES ($1, $2, $3) RETURNING *;
    `;
    const values = [fileName, mimetype, size];
    const result = await pool.query(query, values);

    // Enviar para o S3
    const s3Key = fileName;
    const s3Result = await uploadFileToS3(localPath, s3Key);

    // Remover o arquivo local após o upload
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

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});