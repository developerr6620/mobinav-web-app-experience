FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app
COPY package*.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=dev --ignore-scripts
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
