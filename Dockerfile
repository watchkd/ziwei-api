FROM node:20-alpine

# 安装 git（必须！）
RUN apk add --no-cache git

WORKDIR /src

# 先只拷贝 package.json 安装依赖
COPY package.json ./
RUN npm install --registry=https://registry.npmjs.org --no-fund --no-audit

# 再拷贝代码
COPY . .

CMD ["node", "server.js"]
