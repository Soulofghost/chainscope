FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8008

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY backend/ ./backend/
COPY frontend/ ./frontend/

EXPOSE 8008

CMD ["node", "backend/src/server.js"]
