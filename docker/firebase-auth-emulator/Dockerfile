FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*
RUN npm install -g firebase-tools@15.22.1
EXPOSE 9099 9999
ENTRYPOINT ["firebase"]
CMD ["emulators:start", "--only", "auth"]
