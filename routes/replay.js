var config = require('../confs/conf');

var express = require('express');
var router = express.Router();
var uuid = require('node-uuid');
var HttpStatus = require('http-status-codes');

var storage = require('../mongodb');

//
// streamer disconnection handling
//

var disconnectTimers = {};

function setDisconnectTimer(replayId) {
    // console.log('Set the disconn timer');

    if (config.disconnect.timeout > 0) {
        var timer = setTimeout(disconnectHandler, config.disconnect.timeout, replayId);

        disconnectTimers[replayId] = timer;
    }
}

function clearDisconnectTimer(replayId) {
    // console.log('Clear the disconn timer');

    if (config.disconnect.timeout > 0) {
        clearTimeout(disconnectTimers[replayId]);

        delete disconnectTimers[replayId];
    }
}

function disconnectHandler(replayId) {
    // console.log('Expire the disconn timer');

    delete disconnectTimers[replayId];

    var replayUpdate = {
        bIsLive: false
    };

    storage.setReplayAttrs(replayId, replayUpdate, function(err, results) {
        if (err) {
            console.error(err);
        }
    });
}

function remapReplayKeys(replays){
    var newReplays = [];
    for(i in replays){
        var replay = replays[i];
        var newReplay = {
            AppName: replay.app,
            SessionName: replay.session,
            FriendlyName: replay.friendlyName,
            Timestamp: replay.created,
            SizeInBytes: replay.sizeInBytes,
            DemoTimeInMs: replay.demoTimeInMS,
            bIsLive: replay.bIsLive,
            Changelist: replay.cl,
            NumViewers: replay.numViewers
        };
        newReplays.push(newReplay);
    }
    return newReplays;
}

function ensureUUID(req, res, next){
    var session = req.params.session;
    storage.ensureUUID(session, function(ensuredUuid){
        req.params.session = ensuredUuid;
        next();
    });
}

/**
 * @api {post} /replay?app=:app&version=:version&... Create a replay
 * @apiName CreateReplay
 * @apiGroup Replay
 *
 * @apiParam {String} name name of the replay
 * @apiParam {String} app -
 * @apiParam {String} version -
 * @apiParam {String} cl change list
 * @apiParam {String} friendlyName -
 * @apiParam {String} [meta]
 * @apiParam {String} [users] List of users
 *
 * @apiSuccess {String} sessionId Replay identifier
 */
router.post('/:name?', function (req, res, next) {
    console.log('\n> Create a replay');
    console.log(req.body);

    var id = uuid.v4();

    console.log('created a session ' + id);

    var name = req.params.name || id;	// For anon demo, use ID as its name.
    var app = req.query.app || console.assert(false, 'The \'app\' parameter is missing.');
    var version = req.query.version ? parseInt(req.query.version) : console.assert(false, 'The \'version\' parameter is missing.');
    var cl = req.query.cl ? parseInt(req.query.cl) : console.assert(false, 'The \'cl\' parameter is missing.');
    var friendlyName = req.query.friendlyName || console.assert(false, 'The \'friendlyName\' parameter is missing.');
    var meta = req.query.meta || '';
    var users = req.body.users || [];

    storage.createReplay(id, name, app, version, cl, friendlyName, meta, users, function (err) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            setDisconnectTimer(id);

            res.json({sessionId: id});
        }
    });
});

/**
 * @api {get} /replay Get replays
 * @apiName GetReplays
 * @apiGroup Replay
 *
 * @apiParam {String} app -
 * @apiParam {String} [cl] change list
 * @apiParam {String} [version] -
 * @apiParam {String} [meta]
 * @apiParam {String} [user] User
 * @apiParam {String} [recent]
 * @apiParam {String} [...] Extra parameters
 *
 * @apiSuccess {String} AppName
 * @apiSuccess {String} SessionName
 * @apiSuccess {String} FriendlyName
 * @apiSuccess {String} Timestamp
 * @apiSuccess {String} SizeInBytes
 * @apiSuccess {String} DemoTimeInMS
 * @apiSuccess {String} NumViewers
 * @apiSuccess {Boolean} bIsLive
 * @apiSuccess {Number} Changelist
 */
router.get('/', function (req, res, next) {
    console.log('\n> List replays');

    var app = req.query.app;// || console.assert(false, 'The \'app\' parameter is missing.');
    var cl = req.query.cl ? parseInt(req.query.cl) : null;
    var version = req.query.version ? parseInt(req.query.version) : null;
    var meta = req.query.meta || null;
    var user = req.query.user || null;
    var recent = req.query.recent || ''; //&& console.assert(false, 'The \'recent\' parameter is not supported.');

    storage.listReplays(app, version, cl, meta, user, function (err, replays) {
        if (err) {
            console.error(err.stack);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            console.log('replays list length:'+replays==null ? 0 : replays.length);

            res.status(HttpStatus.OK)
                .json({
                    replays: remapReplayKeys(replays)
                });
        }
    });
});

/**
 * @api {post} /replay/:session/startDownloading Start downloading
 * @apiName StartDownloading
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 * @apiParam {String} user user name
 *
 * @apiSuccess {String} State 'Live' or 'Final'
 * @apiSuccess {int} NumChunks
 * @apiSuccess {String} Time Total demo time in milliseconds
 * @apiSuccess {String} ViewerId Viewer identifier
 */
router.post('/:session/startDownloading', ensureUUID, function (req, res, next) {
    console.log('\n> Start downloading');

    var session = req.params.session;
    var user = req.query.user || null; // When 'user=' is passed, req.query.session is 'undefined'.

    var stats = storage.getReplayStats(session, function (err, stats) {
        if (err) {
            console.error(err.stack);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            var viewer = uuid.v4();

            storage.createReplayViewer(session, user, viewer, function (err, results){
                if (err) {
                    console.error(err.stack);
                    res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();

                    return;
                }

                var ret = {
                    State: stats.bIsLive ? 'Live' : 'Final',
                    NumChunks: stats.numChunks,
                    Time: stats.time,
                    ViewerId: viewer
                }

                console.log(ret);

                res.status(HttpStatus.OK).json(ret);
            });

        }
    });
});

/**
 * @api {post} /replay/:session/users Update replay users
 * @apiName UpdateReplayUsers
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay identifier
 * @apiParam {json} users List of users
 *
 * @apiSuccess (Success No Content 204) {httpResultCode} - 204
 */
router.post('/:session/users', ensureUUID, function (req, res, next) {
    console.log('\n> Update users');
    console.log(req.body);

    var session = req.params.session;
    var users = req.body.users;

    var replayUpdate = {
        users: users
    };

    storage.setReplayAttrs(session, replayUpdate, function (err) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            res.status(HttpStatus.NO_CONTENT).end();
        }
    });
});


/**
 * @api {post} /replay/:session/file/replay.header?numChunks=:numChunks&time=:time Upload replay header
 * @apiName UploadReplayHeader
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 * @apiParam {Number} numChunks
 * @apiParam {Time} time
 * @apiParam {octet-stream} Header data, HeaderArchive.Buffer
 *
 * @apiSuccess (Success No Content 204) {httpResultCode} - 204
 */
router.post('/:session/file/replay.header', ensureUUID, function (req, res, next) {
    console.log('\n> Upload a header');
    
    var session = req.params.session;
    var numChunks = parseInt(req.query.numChunks);
    var time = parseInt(req.query.time);
    var data = req.body;

    storage.createHeader(session, numChunks, time, data, function (err) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            res.status(HttpStatus.NO_CONTENT).end();
        }
    });
});

/**
 * @api {get} /replay/:session/file/replay.header Download replay header
 * @apiName DownloadReplayHeader
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 *
 * @apiSuccess {data} data
 */
router.get('/:session/file/replay.header', ensureUUID, function (req, res, next) {
    console.log('\n> Download a replay header');

    var session = req.params.session;

    storage.readHeader(session, function (err, data) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            res.status(HttpStatus.OK)
                .send(data);
        }
    });
});

/**
 * @api {post} /replay/:session/file/stream.:index?numChunks=:numChunks&time=:time&mTime1=:mTime1&mTime2=:mTime2&absSize=:absSize Upload a chunk
 * @apiName UploadChunk
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 * @apiParam {Number} index Chunk index
 * @apiParam {Number} numChunks Number of chunks uploaded up to this chunk (inclusive)
 * @apiParam {time} time Elapsed time up to the end of this chunk
 * @apiParam {time} mTime1 Start time offset of this chunk
 * @apiParam {time} mTime2 End time offset of this chunk
 * @apiParam {Number} absSize Number of bytes uploaded up to this chunk (inclusive)
 * @apiParam {octet-stream} Chunk data, StreamArchive.Buffer 
 *
 * @apiSuccess (Success No Content 204) {httpResultCode} - 204
 */
router.post('/:session/file/stream.:index', ensureUUID, function (req, res, next) {
    console.log('\n> Upload a chunk');

    var session = req.params.session;
    var index = req.params.index;
    var numChunks = parseInt(req.query.numChunks);
    var time = parseInt(req.query.time);
    var mTime1 = parseInt(req.query.mTime1);
    var mTime2 = parseInt(req.query.mTime2);
    var absSize = parseInt(req.query.absSize);
    var data = req.body;

    storage.createChunk(session, index, numChunks, time, mTime1, mTime2, absSize, data, function (err) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            clearDisconnectTimer(session);
            setDisconnectTimer(session);

            var replayUpdate = {
                numChunks: parseInt(numChunks),
                demoTimeInMS: parseInt(time),
                sizeInBytes: parseInt(absSize)
            };

            storage.setReplayAttrs(session, replayUpdate, function(err, results) {
                
                if (err) {
                    console.error(err);
                }

                res.status(HttpStatus.NO_CONTENT).end();

            });
        }
    });
});

/**
 * @api {get} /replay/:session/file/stream.:index Download a chunk
 * @apiName DownloadChunk
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 *
 * @apiSuccess {headerData} NumChunks
 * @apiSuccess {headerData} Time
 * @apiSuccess {headerData} State
 * @apiSuccess {headerData} MTime1
 * @apiSuccess {headerData} MTime2
 * @apiSuccess {data} data
 */
router.get('/:session/file/stream.:index', ensureUUID, function (req, res, next) {
    console.log('\n> Download a chunk');

    var session = req.params.session;
    var index = req.params.index;

    storage.readChunk(session, index, function (err, attrs, data) {
        console.log(attrs);
        console.log(data);
        if (err && err.code == 'ENOENT') {
            // When a viewer watches a live stream, it hits the end of stream and
            // requests a next chunk that a player is about to upload.
            // Just return HttpStatus.OK with an empty response body.
            console.error(err);
        } else if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .end();
            return;
        }

        storage.getReplayStats(session, function(err, stats) {
            if (err) {
                console.error(err.stack);
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();

                return;
            }

            res.header('NumChunks', stats.numChunks)
                .header('Time', stats.time)
                .header('State', stats.bIsLive ? 'Live' : 'Final')
                .header('MTime1', attrs.metadata.mtime1)
                .header('MTime2', attrs.metadata.mtime2);

            console.log(res.header()._headers);

            res.status(HttpStatus.OK);
            res.send(data);
        });

    });
});

/**
 * @api {get} /replay/:session/stopUploading Stop uploading
 * @apiName StopUploading
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 *
 * @apiSuccess (Success No Content 204) {httpResultCode} - 204
 */
router.post('/:session/stopUploading', ensureUUID, function (req, res, next) {
    console.log('\n> Stop uploading');
    // console.log(req.body);

    var session = req.params.session;

    var replayUpdate = {
        bIsLive: false
    };

    storage.setReplayAttrs(session, replayUpdate, function (err) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            clearDisconnectTimer(session);

            res.status(HttpStatus.NO_CONTENT)
                .end();
        }
    });
});

/**
 * @api {post} /replay/:session/event Upload Event
 * @apiName UploadEvent
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 * @apiParam {String} group Event group name
 * @apiParam {time} time1
 * @apiParam {time} time2
 * @apiParam {String} meta
 * @apiParam {octet-stream} body
 *
 * @apiSuccess (Success No Content 204) {httpResultCode} - 200
 */
router.post('/:session/event', ensureUUID, function (req, res, next) {
    console.log('\n> Create a checkpoint');

    var session = req.params.session;
    var group = req.query.group;
    var time1 = parseInt(req.query.time1);
    var time2 = parseInt(req.query.time2);
    var meta = req.query.meta;
    var data = req.body;

    console.assert(group == 'checkpoint');

    storage.createEvent(group, time1, time2, meta, data, session, function (err) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            res.status(HttpStatus.OK)
                .end();
        }
    });
});

/**
 * @api {get} /replay/:session/event?group=checkpoint Download Events
 * @apiName DownloadEvents
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 * @apiParam {String} group Event group name
 *
 * @apiSuccess {array} events Contains below
 * @apiSuccess {String} _id
 * @apiSuccess {String} session
 * @apiSuccess {String} group
 * @apiSuccess {int} time1
 * @apiSuccess {int} time2
 * @apiSuccess {meta} meta
 * @apiSuccess {date} created
 */
router.get('/:session/event', ensureUUID, function (req, res, next) {
    console.log('\n> List checkpoints');

    var session = req.params.session;
    var group = 'checkpoint';

    storage.readEvents(session, group, function (err, data) {
        if (err) {
            console.error(err);

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
        } else {
            console.log(data);

            res.status(HttpStatus.OK)
                .json({
                    events: data
                });
        }
    });
});

/**
 * @api {post} /replay/:session/viewer/:viewerId Refresh viewer
 * @apiName RefreshViewer
 * @apiGroup Replay
 *
 * @apiParam {String} session Replay session identifier
 * @apiParam {String} viewerId Viewer identifier
 * @apiParam {boolean} [final] true if viewer stopped watching false otherwise
 *
 * @apiSuccess (Success No Content 204) {httpResultCode} - 204
 */
router.post('/:session/viewer/:viewerId', ensureUUID, function (req, res, next) {
    console.log('\n> Refresh a viewer');

    var session = req.params.session || console.assert(false, 'The \'name\' parameter is missing.');
    var viewerId = req.params.viewerId || console.assert(false, 'The \'viewer\' parameter is missing.');
    var final = req.query.final == true ? true: false;

    if (final) {	// delete the viewer

        storage.deleteReplayViewer(session, viewerId, function(err, results) {
            if (err) {
                console.error(err);
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
                return;
            }

            res.status(HttpStatus.NO_CONTENT).end();
        });

    } else {	// refresh the viewer
        storage.refreshReplayViewer(session, viewerId, function(err, results) {
            if (err) {
                console.error(err);
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
                return;
            }

            res.status(HttpStatus.NO_CONTENT).end();
        });

    }

});

module.exports = router;