FROM node:18

WORKDIR /app

COPY . .

RUN npm install --prefix server && \
    npm install --prefix client && \
    npm run build --prefix client

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]