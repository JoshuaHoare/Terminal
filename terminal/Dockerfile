FROM node:20-alpine

# Install Docker CLI so we can spawn module containers
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies) so TypeScript can compile
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY data ./data

# Build TypeScript to JavaScript; fail the build if this does not succeed
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
