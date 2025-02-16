# Stage 1: Build React frontend
FROM node:16 as build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve with Python backend
FROM python:3.9-slim
WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built React app
COPY --from=build /app/build /app/frontend/build

# Expose the port your app runs on
EXPOSE 8000

# Command to run your backend server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]