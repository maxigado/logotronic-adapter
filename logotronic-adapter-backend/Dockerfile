FROM node:20.7.0-alpine3.17

WORKDIR /tubtraceability-backend

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

CMD ["node", "index.js"]

