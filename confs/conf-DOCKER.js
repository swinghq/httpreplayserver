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
    port: 3000,
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
        url:  "{{ .Env.MONGODB_ADDRESS }}",
        gridFsChunkSize: "{{ .Env.GRIDFS_CHUNK_SIZE }}"
    }
}
