# Shared Firebase emulator image for the platform and assessment dev stacks.
#
# Runs the Auth emulator and the Emulator UI, both pure Node. Each stack mounts
# its own config from this directory: firebase.json (platform, canonical port
# 9099) or firebase.assessment.json (assessment, shifted port 9097). The ports
# differ in the configs rather than via Docker port remapping because the
# Emulator UI advertises the config ports to the browser.
#
# No JRE: the Storage emulator was the only emulator here whose security-rules
# runtime needed one, and recording uploads now go through the backend to
# fake-gcs-server instead. Dropping it also removes the pre-downloaded Storage
# JAR, which is what made cold starts slow.
#
# The Emulator UI is pre-downloaded at build time so containers start without
# network access at runtime.
FROM node:24-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g firebase-tools@15.22.1
RUN firebase setup:emulators:ui
EXPOSE 9099 9097 9000
ENTRYPOINT ["firebase"]
CMD ["emulators:start", "--only", "auth"]
