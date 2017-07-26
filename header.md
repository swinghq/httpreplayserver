# Start Guide

- Setup a running mongodb. https://www.mongodb.com

- If using Docker to run the server:
    - Setup docker environment https://www.docker.com
    - Requires a running mongodb. Download and install from https://www.mongodb.com or use docker to set it up (https://hub.docker.com/_/mongo/)
    - Command to pull the replay server docker image
    ```$ docker pull minkonet/httpreplayserver```
    - Command to start the container from the image
    ```$ docker run -d --name replayserver -p 3000:3000 -e MONGODB_ADDRESS="mongodb://xxx.xxx.xxx.xxx:xx/replayDB" -e GRIDFS_CHUNK_SIZE="1048567" minkonet/httpreplayserver```

- Not using Docker:
    - Setup Node.js environment https://nodejs.org
    - Checkout the source
    - Open confs/conf.js and modify mongodb.url
    - npm install
    - npm start

# Basic API call flow
- Uploading a replay:
    1. CreateReplay
    2. UploadReplayHeader
    3. UploadChunk
    4. StopUploading

- Download a replay
    1. StartDownloading
    2. DownloadReplayHeader
    3. DownloadChunk

