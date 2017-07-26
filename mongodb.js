/**
 * Created by changyu on 17. 4. 7.
 */

const uuid = require('node-uuid');
var async = require("async");
var stream = require("stream");

var conf = require("./confs/conf");
var Logger = require('./helpers/logger');

var log = Logger();

log.debug({action: 'initMongoDB', url: conf.mongodb.url}, 'INIT');

var mongodb = require('mongodb');
var GridFSBucket = require('mongodb').GridFSBucket;

function connect(models, cb) {
    mongodb.MongoClient.connect(conf.mongodb.url, function(err, database) {
        if (err)
            throw cb(err);

        models.db = database;

        return cb(null, models);
    });
}

function ensureIndex(indexOption, cb) {
    var collection = indexOption.collection;
    collection.ensureIndex(indexOption.fieldOrSpec, indexOption.options, function (err, result) {
        if (err) {
            cb (err);
        }

        cb (null, result);
    });
}

function createReplays(models, cb) {
    var replays = models.db.collection('replayCollection');

    var indexOptions = [
        {collection: replays, fieldOrSpec:{session: 1}, options: {name: "SessionIndex"}},
        {collection: replays, fieldOrSpec:{app: 1, version: 1, bIsLive: 1, created: 1}, options:{name: "VersionAppSortIndex"}},
        {collection: replays, fieldOrSpec:{app: 1, bIsLive: 1, created: 1}, options:{name: "AppSortIndex"}},
        {collection: replays, fieldOrSpec:{app: 1, meta: 1}, options:{name: "AppMetaSortIndex"}},
        {collection: replays, fieldOrSpec:{app: 1, users: 1, created: 1}, options:{name: "AppUserIndex"}},
        {collection: replays, fieldOrSpec:{created: 1}, options:{name: "CreatedIndex"}},
        {collection: replays, fieldOrSpec:{modified: 1}, options:{name: "ModifiedIndex"}},
        {collection: replays, fieldOrSpec:{friendlyName: 1, modified: -1}, options:{name: "FriendlyNameSortIndex"}}
    ]

    async.each(indexOptions, ensureIndex, function (err, result) {
        if (err)
            throw cb(err);

        models.replays = replays;

        return cb(null, models);
    })
}

function createViewers(models, cb) {
    var viewers = models.db.collection('viewerCollection');

    var indexOptions = [
        {collection: viewers, fieldOrSpec:{session: 1}, options: {name: "VSessionIndex"}},
        {collection: viewers, fieldOrSpec:{viewer: 1}, options:{name: "ViewerIndex"}},
        {collection: viewers, fieldOrSpec:{modified: 1}, options:{name: "VModifiedIndex"}},
    ]

    async.each(indexOptions, ensureIndex, function (err, result) {
        if (err)
            throw cb(err);

        models.viewers = viewers;

        return cb(null, models);
    })
}

function createRecents(models, cb) {
    var recents = models.db.collection('recentCollection');

    var indexOptions = [
        {collection: recents, fieldOrSpec:{user: 1}, options: {name: "RecentUserIndex"}}
    ]

    async.each(indexOptions, ensureIndex, function (err, result) {
        if (err)
            throw cb(err);

        models.recents = recents;

        return cb(null, models);
    })
}

function createEvents(models, cb) {
    var events = models.db.collection('eventCollection');

    var indexOptions = [
        {collection: events, fieldOrSpec:{session: 1, group: 1, time1: 1}, options: {name: "ESessionIndex"}},
        {collection: events, fieldOrSpec:{modified: 1}, options: {name: "EModifiedIndex"}}
    ]

    async.each(indexOptions, ensureIndex, function (err, result) {
        if (err)
            throw cb(err);

        models.events = events;

        return cb(null, models);
    })
}

function createLogs(models, cb) {
    var logs = models.db.collection('logCollection');

    var indexOptions = [
        {collection: logs, fieldOrSpec:{level: 1, created: 1}, options: {name: "LevelIndex"}},
        {collection: logs, fieldOrSpec:{created: 1}, options: {name: "LCreatedIndex"}}
    ]

    async.each(indexOptions, ensureIndex, function (err, result) {
        if (err)
            throw cb(err);

        models.logs = logs;

        return cb(null, models);
    })
}

function createReplayFSBucket(models, cb) {

    var replayFS = new GridFSBucket(models.db, { bucketName: 'replayFS' });

    models.replayFS = replayFS;

    return cb(null, models);
}

var models = {};
async.waterfall([
    async.apply(connect, models),
    createReplays,
    createViewers,
    createRecents,
    createEvents,
    createLogs,
    createReplayFSBucket
], function(error, models) {
    if (error)
        console.error(error);
});


var storage = {};

storage.mongodb = mongodb.MongoClient;

//for local testing purpose
storage.ensureUUID = function(str, cb){
    if(str.length != 36){
        storage.findReplayByFriendlyName({replayName: str}, function(error, replay){
            cb(replay.session.value());
        });
    }else{
        cb(str);
    }
}

storage.listReplays = function(app, version, cl, meta, user, cb) {
    
    var query = {};

    if(app) query.app = app;
    if(version) query.version = version;
    if(cl) query.cl = cl;
    if(meta) query.meta = meta;
    if(user) query.users = user;
    
    models.replays.find(query).sort({created: -1}).toArray().then(function(results){
        for(i in results){
            results[i].session = results[i].session.value();
        }
        cb(null, results);
    }).catch(function(e){
        cb(e);
    });
    
}

storage.createReplay = function(session, name, app, version, cl, friendlyName, meta, users, cb) {

    log.debug('MONGODB START', 'createReplay');

    var now = new Date();

    var replays = models.replays;
    replays.insertOne({
        session: mongodb.Binary(session, mongodb.Binary.SUBTYPE_UUID),
        app: app,
        version: version,
        cl: cl,
        friendlyName: friendlyName,
        created: now,
        modified: now,
        bIsLive: true,
        bIncomplete: true,
        demoTimeInMS: 0,
        sizeInBytes: 0,
        meta: meta,
        users: users,
        numViewers: 0
    }).then(function(r) {
        log.debug('MONGODB END:', r);
        cb(null, r);
    }).catch(function(e) {
        console.error(e);
        cb(e);
    });
}

storage.getReplayStats = function(session, cb) {

    log.debug('MONGODB START', 'getReplayStats');

    var ctx = {
        session: session
    };

    async.waterfall([
        async.apply(findReplayBySession, ctx),
        getReplayStatsInternal
    ], function(swingError, ctx) {
        if (swingError) {
            return cb(swingError);
        }

        log.debug('MONGODB END:', ctx);
        return cb(null, ctx.stats);
    });
}

storage.setReplayAttrs = function(session, nameValuePairs, cb){

    log.debug('MONGODB START', 'setReplayAttrs');

    var document = {};
    var keys = Object.keys(nameValuePairs);

    for(i in keys){
        document[keys[i]] = nameValuePairs[keys[i]];
    }
    document['modified'] = new Date();

    models.replays.updateOne({
        session: mongodb.Binary(session, mongodb.Binary.SUBTYPE_UUID)
    }, {
        $set: document
    }).then(function(r){
        log.debug('MONGODB END:', r);
        return cb(null, r);
    }).catch(function(e){
        log.error(JSON.stringify(e, null, 2));
        return cb(e);
    });
}

storage.getReplayAttr = function(session, name, cb) {

    log.debug('MONGODB START', 'getReplayAttr');

    models.replays.findOne({
        session: session
    }).then(function(r){
        log.debug('MONGODB END:', r);
        return cb(null, r);
    }).catch(function(e){
        log.error(JSON.stringify(e, null, 2));
        return cb(e);
    });

}

storage.createReplayViewer = function(session, user, viewerId, cb) {

    log.debug('MONGODB START', 'createReplayViewer');

    var ctx = {
        session: session,
        user: user,
        viewerId: viewerId
    };

    async.waterfall([
        async.apply(findReplayBySession, ctx),
        createReplayViewerInternal
    ], function(swingError, ctx) {
        if (swingError) {
            return cb(swingError);
        }

        log.debug('MONGODB END:', ctx);
        return cb(null, ctx.viewer);
    });
}

storage.deleteReplayViewer = function(session, viewerId, cb) {

    log.debug('MONGODB START', 'deleteReplayViewer');

    var ctx = {
        session: session,
        viewerId: viewerId
    };

    async.waterfall([
        async.apply(findReplayBySession, ctx),
        deleteReplayViewerInternal
    ], function(swingError, ctx) {
        if (swingError) {
            return cb(swingError);
        }

        log.debug('MONGODB END:' + ctx);
        return cb(null, ctx.viewerId);
    });

}

storage.refreshReplayViewer = function(session, viewerId, cb) {

    log.debug('MONGODB START', 'refreshReplayViewer');

    var ctx = {
        session: session,
        viewerId: viewerId
    };

    async.waterfall([
        async.apply(findReplayBySession, ctx),
        refreshReplayViewerInternal
    ], function(swingError, ctx) {
        if (swingError) {
            return cb(swingError);
        }

        log.debug('MONGODB END:', ctx);
        return cb(null, ctx.viewer);
    });
}

storage.createHeader = function(session, numChunks, time, data, cb) {

    var ctx = {
        session: session
    };

    findReplayBySession(ctx, function(error, result){
        var replay = result.replay;
        if(error){
            cb(error);
        }else{
            var metaData = {
                session: replay.session,
                mtime1: time,
                mtime2: time,
                numChunks: numChunks
            };
            storeFile(replay.session+"/replay.header", metaData, data, function(error, id){
                cb(null, id);
            });
        }
    });

}

storage.readHeader = function(session, cb) {

    retrieveFile(session+"/replay.header", function(error, fileInfo, chunk){
        if(error){
            cb(error);
        }else{
            cb(null, chunk);
        }
    });

}

storage.createChunk = function(session, index, numChunks, time, mTime1, mTime2, absSize, data, cb) {
    var ctx = {
        session: session
    };

    findReplayBySession(ctx, function(error, result){
        var replay = result.replay;
        if(error){
            cb(error);
        }else{
            var metaData = {
                session: replay.session,
                mtime1: mTime1,
                mtime2: mTime2,
                numChunks: numChunks,
                time: time,
                absSize: absSize
            };
            storeFile(replay.session+"/stream."+index, metaData, data, function(error, id){
                cb(null, id);
            });
        }
    });
}

storage.readChunk = function(session, index, cb) {

    retrieveFile(session+"/stream."+index, function(error, fileInfo, chunk){
        if(error){
            cb(error);
        }else{
            cb(null, fileInfo, chunk);
        }
    });

}

storage.createEvent = function(group, time1, time2, meta, data, session, cb) {

    log.debug('MONGODB START', 'createEvent');

    models.events.insertOne({
        session: mongodb.Binary(session, mongodb.Binary.SUBTYPE_UUID),
        group: group,
        time1: time1,
        time2: time2,
        data: data,
        meta: meta,
        created: new Date()
    }).then(function(r) {
        log.debug('MONGODB END', r);
        cb(null, r);
    }).catch(function(e) {
        console.error(e);
        cb(e);
    });
}

storage.readEvent = function(eventId, cb) {

    log.debug('MONGODB START', 'readEvent');

    models.events.findOne({_id: eventId}).then(function(event){
        log.debug('MONGODB END', event);
        cb(null, event);
    }).catch(function(error){
        cb(error);
    });
}

storage.readEvents = function(session, group, cb) {

    log.debug('MONGODB START', 'readEvents');

    var query = {
        session: mongodb.Binary(session, mongodb.Binary.SUBTYPE_UUID)
    };

    if(group) query.group = group;

    models.events.find(query, {
        session: 1, group: 1, time1: 1, time2: 1, meta: 1, created: 1
    }).toArray().then(function(events){
        for(i in events){
            events[i].session = events[i].session.value();
        }
        cb(null, events);
        log.debug('MONGODB END', events);
    }).catch(function(e) {
        console.error(e);
        cb(e);

    });
}

storage.readEventsByGroup = function(group, cb){

    log.debug('MONGODB START', 'readEventsByGroup');

    var events = models.events;
    events.find({
        group: group
    }, {
        session: 1, group: 1, time1: 1, time2: 1, meta: 1, created: 1
    }).toArray().then(function(events){
        for(i in events){
            events[i].session = events[i].session.value();
        }
        ctx.events = events;
        cb(null, ctx);
        log.debug('MONGODB END', events);
    }).catch(function(e) {
        console.error(e);
        cb(e);

    });
}

storage.storeFile = storeFile;

function storeFile(filename, metadata, file, cb){

    var options = {
        chunkSizeBytes: conf.mongodb.gridFsChunkSize,
        metadata: metadata
    };
    
    var replayFS = models.replayFS;
    var uploadStream = replayFS.openUploadStream(filename, options);
    var streamId = uploadStream.id;

    var readStream = new stream.Readable;

    readStream._read = function(){
        this.push(file);
        this.push(null);
    };

    uploadStream.once('finish', function(){

        var chunksColl = models.db.collection('replayFS.chunks');
        var chunksQuery = chunksColl.find({files_id: streamId});

        chunksQuery.toArray(function(error, docs){
            if(error){
                cb(error);
                return;
            }

            var filesColl = models.db.collection('replayFS.files');
            var filesQuery = filesColl.find({_id: streamId});

            filesQuery.toArray(function(error, docs){

                if(error){
                    cb(error);
                    return;
                }
                cb(null, streamId);

            });
        });

    });

    readStream.pipe(uploadStream);
}

storage.retrieveFile = retrieveFile;

function retrieveFile(fileName, cb){

    var replayFS = models.replayFS;

    models.db.collection('replayFS.files').findOne({
        filename: fileName
    }, {
        sort: [["uploadDate", -1]]
    }).then(function(repInfo){
        if(repInfo){

            var downloadStream = replayFS.openDownloadStream(repInfo._id);

            var binData = new Buffer(0);

            downloadStream.on('data', function(data){
                binData = Buffer.concat([binData, data]);
            });

            downloadStream.on('end', function(){
                if(binData){
                    cb(null, downloadStream.s.file, binData);
                }else{
                    cb('Failed to retrieve file');
                }
            });

            downloadStream.on('error', function(error){
                cb(error);
            });

        }else{
            cb("file not found.");
        }
    }).catch(function(error){
        cb(error);
    });

}

storage.findReplayBySession = findReplayBySession;

function findReplayBySession(ctx, cb){
    console.log(ctx.session);
    models.replays.findOne({
        session: mongodb.Binary(ctx.session, mongodb.Binary.SUBTYPE_UUID)
    }).then(function(r){
        if(r){
            r.session = r.session.value();
            ctx.replay = r;
            cb(null, ctx);
        }else{
            cb("Replay not found by the given session id");
        }
    }).catch(function(e){
        cb(e);
    });
}

storage.findReplayByFriendlyName = findReplayByFriendlyName;

function findReplayByFriendlyName(ctx, cb) {

    var replays = models.replays;
    replays.findOne({
        friendlyName:ctx.replayName
    }, {
        sort: [["modified", -1]]
    }).then(function(r) {
        cb(null, r);
    }).catch(function(e) {
        cb(e);
    });
}

storage.refreshReplayViewerInternal = refreshReplayViewerInternal;

function refreshReplayViewerInternal(ctx, cb) {

    var stime = Date.now();

    models.viewers.updateOne({
        session: ctx.replay.session,
        viewer: ctx.viewerId
    }, {
        $set: {modified:  new Date()}
    }).then(function (viewer) {
        models.viewers.findOne({
            session: ctx.replay.session,
            viewer: ctx.viewerId
        }).then(function(viewer) {
            ctx.viewer = viewer;
            console.log('#refreshReplayViewerInternal:' + (Date.now() - stime));
            cb(null, ctx);
        });
    });
}

storage.createReplayViewerInternal = createReplayViewerInternal;

function createReplayViewerInternal(ctx, cb) {

    var stime = Date.now();

    models.viewers.insert({
        session: ctx.replay.session,
        user: ctx.user,
        viewer: ctx.viewerId,
        modified: new Date()
    }).then(function(viewer) {

        ctx.viewer = viewer.ops[0];
        console.log('#createReplayViewerInternal:' + (Date.now() - stime));
        cb(null, ctx);
    }).catch(function(e) {
        cb(e);
    });

}

storage.getReplayStatsInternal = getReplayStatsInternal;
function getReplayStatsInternal(ctx, cb) {

    var regex = new RegExp("^"+ctx.replay.session);

    models.db.collection('replayFS.files').findOne({
        "filename": regex
    }, {
        sort: [["metadata.mtime2", -1], ["uploadDate", -1]]
    }).then(function(replayFile){
        ctx.stats = {
            bIsLive: ctx.replay.bIsLive,
            numChunks: replayFile.metadata.numChunks,
            time: replayFile.metadata.mtime2
        };
        cb(null, ctx);
    }).catch(function(error){
        cb(error);
    });
}

storage.deleteReplayViewerInternal = deleteReplayViewerInternal;
function deleteReplayViewerInternal(ctx, cb) {

    models.viewers.deleteOne({
        session: ctx.replay.session,
        viewer: ctx.viewerId
    }).then(function(viewer) {
        cb(null, ctx);
    }).catch(function(e) {
        cb(e);
    });
}

module.exports = storage;