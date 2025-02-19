# Usar Node.js como base
FROM node:18

# Definir o diretório de trabalho
WORKDIR /app

# Copiar os arquivos do projeto para dentro do container
COPY package*.json ./
RUN npm install

# Copiar o restante do código
COPY . .

# Expor a porta usada pelo backend
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
