FROM node:20-alpine
WORKDIR /src
COPY package.json ./
RUN npm install --registry=https://registry.npmjs.org --no-fund --no-audit
COPY . .
CMD ["node", "server.js"]
