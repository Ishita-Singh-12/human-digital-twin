FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ml/requirements.txt ml/requirements.txt
RUN python3 -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r ml/requirements.txt
COPY web/health-dashboard/package*.json web/health-dashboard/
RUN cd web/health-dashboard && npm ci --legacy-peer-deps
COPY . .
RUN /app/.venv/bin/python ml/stress_model.py train
WORKDIR /app/web/health-dashboard
ENV HDT_PROJECT_ROOT=/app HDT_PYTHON=/app/.venv/bin/python
ARG NEXT_PUBLIC_APPWRITE_ENDPOINT
ARG NEXT_PUBLIC_APPWRITE_PROJECT_ID
ENV NEXT_PUBLIC_APPWRITE_ENDPOINT=$NEXT_PUBLIC_APPWRITE_ENDPOINT NEXT_PUBLIC_APPWRITE_PROJECT_ID=$NEXT_PUBLIC_APPWRITE_PROJECT_ID
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
