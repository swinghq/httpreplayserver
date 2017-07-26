/**
 * Created by changyu on 12/31/15.
 */
var bunyan = require('bunyan');
var conf = require('../confs/conf');

module.exports = function () {    
    var logger = bunyan.createLogger({
        name: conf.ps.log.facility,
        streams: [
            {
                stream: process.stdout,
                type: 'stream',
                level: conf.ps.log.level
            }
        ]
    });
    return logger;
};
