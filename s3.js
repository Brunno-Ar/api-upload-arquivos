const AWS = require('aws-sdk');
require('dotenv').config();

// Configuração do AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

/**
 * Função para enviar um arquivo ao S3.
 * @param {string} filePath - Caminho local do arquivo.
 * @param {string} key - Nome com o qual o arquivo será salvo no S3.
 * @returns {Promise} - Retorna uma promise com os dados do upload.
 */
function uploadFileToS3(filePath, key) {
  const fs = require('fs');
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key, // Nome do arquivo no S3
    Body: fileContent,
  };

  return s3.upload(params).promise();
}

module.exports = { uploadFileToS3 };
