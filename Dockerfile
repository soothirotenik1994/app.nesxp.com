# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine
WORKDIR /app
# Install a simple static server
RUN npm install -g serve
# Copy build output from stage 1
COPY --from=build /app/dist ./dist

# Expose port 3000 as required by the environment
EXPOSE 3000

# Serve the static files
CMD ["serve", "-s", "dist", "-l", "3000"]
