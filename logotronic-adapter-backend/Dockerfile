FROM node:25.2-alpine3.22

# Install git for auto-update functionality
RUN apk add --no-cache git

WORKDIR /logotronic-adapter-backend

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

CMD ["node", "startup.js"]