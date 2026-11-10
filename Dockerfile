FROM node:24-alpine

WORKDIR /app

# Install dependencies first so this layer is cached between builds.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 3000

# --watch restarts the server whenever a file in src/ changes.
CMD ["node", "--watch", "src/server.js"]
