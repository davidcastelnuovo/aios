FROM mcr.microsoft.com/playwright:v1.55.0-jammy
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=8787
EXPOSE 8787
CMD ["node", "src/server.mjs"]
