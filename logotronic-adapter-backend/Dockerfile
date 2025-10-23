FROM node:25.0.0-alpine3.21

WORKDIR /logotronic-adapter-backend

COPY package.json .

RUN npm install

# Install git so the container can update code at startup
RUN apk add --no-cache git ca-certificates openssh

# Copy app and git metadata
COPY .git/ .git/
COPY . .

RUN npm run build

# Add an entrypoint script that will attempt to fetch latest code before starting
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "index.js"]

