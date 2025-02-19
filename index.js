require("dotenv").config();
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors"); // <== IMPORTADO AQUI
const pool = require("./db");
const { uploadFileToS3 } = require("./s3");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // <== HABILITA O CORS

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

app.post("/upload", upload.any(), async (req, res) => {
  console.log("Recebendo requisição no backend!", req.body, req.files);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Nenhum arquivo enviado!" });
  }

  const fileName = req.body.fileName;
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

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
