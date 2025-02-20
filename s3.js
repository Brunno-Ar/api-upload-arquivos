const AWS = require('aws-sdk');
require('dotenv').config();
const fs = require('fs');

// Log para verificar a variável de ambiente
console.log("Nome do bucket S3:", process.env.AWS_BUCKET_NAME);

// Configuração do AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Função para enviar um arquivo para o S3
async function uploadFileToS3(filePath, fileName) {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME, // Nome do bucket
    Key: fileName, // Nome do arquivo no S3
    Body: fs.createReadStream(filePath), // Conteúdo do arquivo
  };

  try {
    console.log(`Enviando arquivo para o S3: ${fileName}`);
    const result = await s3.upload(params).promise();
    console.log(`Arquivo enviado para o S3: ${fileName}`);
    return result;
  } catch (error) {
    console.error("Erro ao enviar arquivo para o S3:", error);
    throw error;
  }
}

/**
 * Função para excluir um arquivo do S3.
 * @param {string} key - Nome do arquivo a ser excluído no S3.
 * @returns {Promise} - Retorna uma promise com o resultado da exclusão.
 */
async function deleteFileFromS3(key) {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME, // Use a mesma variável para o bucket
    Key: key, // Nome do arquivo no S3
  };

  try {
    await s3.deleteObject(params).promise();
    console.log(`Arquivo excluído do S3: ${key}`);
  } catch (error) {
    console.error("Erro ao excluir arquivo do S3:", error);
    throw error;
  }
}

module.exports = { uploadFileToS3, deleteFileFromS3 };