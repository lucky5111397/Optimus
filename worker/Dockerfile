FROM node:20-alpine

# Install Git for repository operations inside worker
RUN apk add --no-cache git

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy worker source
COPY . .

# Expose worker port
EXPOSE 8080

ENV PORT=8080 \
    NODE_ENV=production

CMD ["npm", "start"]
