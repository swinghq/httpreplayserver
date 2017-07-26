var express = require('express');
var router = express.Router();
var HttpStatus = require('http-status-codes');

var storage = require('../mongodb');

/**
 * @api {get} /event/:eventId Download an event
 * @apiName DownloadEvent
 * @apiGroup Event
 *
 * @apiParam {String} eventId Event identifier
 *
 * @apiSuccess {httpResultCode} 204
 */
router.get('/:id', function(req, res, next) {
	console.log('\n> Download an event');

	var eventId = req.params.eventId || console.assert(false, 'The \'id\' parameter is missing.');;

	storage.readEvent(eventId, function(err, event) {
		if (err) {
			console.error(err);

			res.status(HttpStatus.INTERNAL_SERVER_ERROR)
				.end();
		} else {
			res.status(HttpStatus.OK)
				.send(event.data);
		}
	});	
});

/**
 * @api {get} /event?group=:group List Events
 * @apiName ListEvents
 * @apiGroup Replay
 *
 * @apiParam {String} group Event group name
 *
 * @apiSuccess ...
 */
router.get('/', function (req, res, next) {
    console.log('\n> List events');

	var group = req.query.group || console.assert(false, 'The \'group\' parameter is missing.');

    storage.readEventsByGroup(group, function (err, data) {
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

module.exports = router;