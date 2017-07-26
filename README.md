<a name="top"></a>
# ReplayServer v0.0.0



- [Event](#event)
	- [Download an event](#download-an-event)
	
- [Replay](#replay)
	- [Create a replay](#create-a-replay)
	- [Download a chunk](#download-a-chunk)
	- [Download Events](#download-events)
	- [Download replay header](#download-replay-header)
	- [Get replays](#get-replays)
	- [List Events](#list-events)
	- [Refresh viewer](#refresh-viewer)
	- [Start downloading](#start-downloading)
	- [Stop uploading](#stop-uploading)
	- [Update replay users](#update-replay-users)
	- [Upload a chunk](#upload-a-chunk)
	- [Upload Event](#upload-event)
	- [Upload replay header](#upload-replay-header)
	


# Start Guide

- Setup a running mongodb. https://www.mongodb.com

- If using Docker to run the server:
    - Setup docker environment https://www.docker.com
    - Requires a running mongodb. Download and install from https://www.mongodb.com or use docker to set it up (https://hub.docker.com/_/mongo/)
    - Command to pull the replay server docker image
    ```$ docker pull minkonet/httpreplayserver```
    - Command to start the container from the image
    ```$ docker run -d --name replayserver -p 3300:3300 -e MONGODB_ADDRESS="mongodb://xxx.xxx.xxx.xxx:xx/replayDB" -e GRIDFS_CHUNK_SIZE="1048567" minkonet/httpreplayserver```

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


# Event

## Download an event
[Back to top](#top)



	GET /event/:eventId





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| eventId | String | <p>Event identifier</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| 204 | httpResultCode | |

# Replay

## Create a replay
[Back to top](#top)



	POST /replay?app=:app&amp;version=:version&amp;...





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| name | String | <p>name of the replay</p>|
| app | String | <ul> <li></li> </ul>|
| version | String | <ul> <li></li> </ul>|
| cl | String | <p>change list</p>|
| friendlyName | String | <ul> <li></li> </ul>|
| meta | String | **optional**|
| users | String | **optional**<p>List of users</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| sessionId | String | <p>Replay identifier</p>|

## Download a chunk
[Back to top](#top)



	GET /replay/:session/file/stream.:index





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| NumChunks | headerData | |
| Time | headerData | |
| State | headerData | |
| MTime1 | headerData | |
| MTime2 | headerData | |
| data | data | |

## Download Events
[Back to top](#top)



	GET /replay/:session/event?group=checkpoint





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|
| group | String | <p>Event group name</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| events | array | <p>Contains below</p>|
| _id | String | |
| session | String | |
| group | String | |
| time1 | int | |
| time2 | int | |
| meta | meta | |
| created | date | |

## Download replay header
[Back to top](#top)



	GET /replay/:session/file/replay.header





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| data | data | |

## Get replays
[Back to top](#top)



	GET /replay





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| app | String | <ul> <li></li> </ul>|
| cl | String | **optional**<p>change list</p>|
| version | String | **optional**<ul> <li></li> </ul>|
| meta | String | **optional**|
| user | String | **optional**<p>User</p>|
| recent | String | **optional**|
| ... | String | **optional**<p>Extra parameters</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| AppName | String | |
| SessionName | String | |
| FriendlyName | String | |
| Timestamp | String | |
| SizeInBytes | String | |
| DemoTimeInMS | String | |
| NumViewers | String | |
| bIsLive | Boolean | |
| Changelist | Number | |

## List Events
[Back to top](#top)



	GET /event?group=:group





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| group | String | <p>Event group name</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| ... |  | |

## Refresh viewer
[Back to top](#top)



	POST /replay/:session/viewer/:viewerId





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|
| viewerId | String | <p>Viewer identifier</p>|
| final | boolean | **optional**<p>true if viewer stopped watching false otherwise</p>|


### Success No Content 204

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| - | httpResultCode | <p>204</p>|

## Start downloading
[Back to top](#top)



	POST /replay/:session/startDownloading





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|
| user | String | <p>user name</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| State | String | <p>'Live' or 'Final'</p>|
| NumChunks | int | |
| Time | String | <p>Total demo time in milliseconds</p>|
| ViewerId | String | <p>Viewer identifier</p>|

## Stop uploading
[Back to top](#top)



	GET /replay/:session/stopUploading





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|


### Success No Content 204

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| - | httpResultCode | <p>204</p>|

## Update replay users
[Back to top](#top)



	POST /replay/:session/users





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay identifier</p>|
| users | json | <p>List of users</p>|


### Success No Content 204

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| - | httpResultCode | <p>204</p>|

## Upload a chunk
[Back to top](#top)



	POST /replay/:session/file/stream.:index?numChunks=:numChunks&amp;time=:time&amp;mTime1=:mTime1&amp;mTime2=:mTime2&amp;absSize=:absSize





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|
| index | Number | <p>Chunk index</p>|
| numChunks | Number | <p>Number of chunks uploaded up to this chunk (inclusive)</p>|
| time | time | <p>Elapsed time up to the end of this chunk</p>|
| mTime1 | time | <p>Start time offset of this chunk</p>|
| mTime2 | time | <p>End time offset of this chunk</p>|
| absSize | Number | <p>Number of bytes uploaded up to this chunk (inclusive)</p>|
| Chunk | octet-stream | <p>data, StreamArchive.Buffer</p>|


### Success No Content 204

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| - | httpResultCode | <p>204</p>|

## Upload Event
[Back to top](#top)



	POST /replay/:session/event





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|
| group | String | <p>Event group name</p>|
| time1 | time | |
| time2 | time | |
| meta | String | |
| body | octet-stream | |


### Success No Content 204

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| - | httpResultCode | <p>200</p>|

## Upload replay header
[Back to top](#top)



	POST /replay/:session/file/replay.header?numChunks=:numChunks&amp;time=:time





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| session | String | <p>Replay session identifier</p>|
| numChunks | Number | |
| time | Time | |
| Header | octet-stream | <p>data, HeaderArchive.Buffer</p>|


### Success No Content 204

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| - | httpResultCode | <p>204</p>|

