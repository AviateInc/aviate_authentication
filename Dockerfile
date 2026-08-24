FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build Typescript
RUN npm run build

# Expose port 
EXPOSE 5000

# Start server
CMD ["npm", "start"]