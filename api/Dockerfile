FROM node:20-slim

WORKDIR /app/api

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
