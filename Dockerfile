# Stage 1: Build React frontend
FROM node:16 as build
WORKDIR /app

# Copy package.json and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Serve with Python backend
FROM python:3.9-slim
WORKDIR /app

# Install system dependencies (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built React app
COPY --from=build /app/dist /app/frontend/dist

# Expose the port your app runs on
EXPOSE 8000

# Command to run your backend server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]