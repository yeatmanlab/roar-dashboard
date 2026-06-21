FROM node:22-slim
RUN npm install -g firebase-tools@15
EXPOSE 9099
ENTRYPOINT ["firebase"]
CMD ["emulators:start", "--only", "auth"]
