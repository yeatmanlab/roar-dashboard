# Shared Firebase emulator image for the platform and assessment dev stacks.
#
# Runs the Auth emulator (pure Node) and optionally the Storage emulator, whose
# security-rules runtime needs a JRE. Each stack selects its emulators via
# `--only` in its compose command and mounts its own config from this directory:
# firebase.json (platform, canonical ports 9099/9199) or firebase.assessment.json
# (assessment, shifted ports 9097/9197). The ports differ in the configs rather
# than via Docker port remapping because the Emulator UI advertises the config
# ports to the browser.
#
# The Storage emulator JAR and the Emulator UI are pre-downloaded at build time
# so containers start without network access at runtime.
# trixie (Debian 13) base — firebase-tools 14+ requires Java 21, which Debian 12
# (the default node:24-slim base) doesn't package.
FROM node:24-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl openjdk-21-jre-headless && rm -rf /var/lib/apt/lists/*
RUN npm install -g firebase-tools@15.22.1
RUN firebase setup:emulators:storage && firebase setup:emulators:ui
EXPOSE 9099 9199 9097 9197 9000
ENTRYPOINT ["firebase"]
CMD ["emulators:start", "--only", "auth"]
