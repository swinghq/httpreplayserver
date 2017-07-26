module.exports = {
    //-------------------------------------------------------------------------
    // Application Configuration
    //-------------------------------------------------------------------------
    ps: {
        log: {
            level: "info",
            facility: "PS"
        }
    },
    port: 3300,
    disconnect: {
        timeout: 10000 // in milliseconds, 0 to disable it
    },

    //-------------------------------------------------------------------------
    // Swing Resources
    //-------------------------------------------------------------------------

    //-------------------------------------------------------------------------
    // External Resources
    //-------------------------------------------------------------------------
    mongodb: {
        url:  "mongodb://localhost:27017/replayDB",
        gridFsChunkSize: 1048567
    }
}