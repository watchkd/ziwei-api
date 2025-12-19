FROM node:20-alpine
WORKDIR /src
RUN npm config set registry https://registry.npmmirror.com
COPY . .
RUN npm install
CMD ["node", "server.js"]
