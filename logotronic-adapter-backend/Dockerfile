FROM node:25.2-alpine3.21

WORKDIR /logotronic-adapter-backend

# Install PM2 globally for process management and auto-restart
RUN npm install -g pm2

COPY package.json .

RUN npm install

COPY . .

RUN npx tsc && \
    mkdir -p dist/views dist/errortexts && \
    cp -R src/views/. dist/views/ && \
    cp -R src/errortexts/. dist/errortexts/

# Use PM2 runtime for production (auto-restart on exit)
CMD ["pm2-runtime", "index.js"]





