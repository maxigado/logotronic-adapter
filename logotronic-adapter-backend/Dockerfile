FROM node:25.0.0-alpine3.21

WORKDIR /tubtraceability-backend

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

CMD ["node", "index.js"]

