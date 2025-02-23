FROM --platform=linux/amd64 oven/bun:latest

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
COPY bun.lock ./

# Create .dockerignore if it doesn't exist
RUN touch .dockerignore && echo "node_modules" >> .dockerignore

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

EXPOSE 3000

CMD ["bun", "run", "./src/server"]