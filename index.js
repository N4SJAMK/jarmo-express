'use strict';

var dgram = require('dgram');

/**
 * Default configuration.
 */
var defaultConfig = {
	host: 'localhost', port: 8000, error: defaultError, resolve: defaultResolve
}

/**
 * The UDP client that we use.
 */
var client = dgram.createSocket('udp4');

/**
 * Simple middleware for ExpressJS. Records response time and allows for custom
 * resolve function. Data is sent via UDP to the configured Jarmo server. This
 * is heavily influenced by the 'express-statsd' module.
 *
 * @param {object}   config
 * @param {string}   config.host     Host of the Jarmo server.
 * @param {number}   config.port     Port of the Jarmo server.
 * @param {function} config.resolve  Function used to resolve the sent data.
 *                             .
 * @return {function} The middleware function.
 */
module.exports = function jarmo(config) {
	if(!process.env.JARMO_ENABLE) {
		// By default the middleware is just pass-through, so you don't need to
		// do any special configuration for your development environment. In
		// order to enable it you must set the 'JARMO_ENABLE' env variable.
		console.log([
			'By default \'jarmo-express\' is disabled, you can enable it by',
			'setting the JARMO_ENABLE environmental variable.'
		].join(' '));
		return function(req, res, next) { return next(); }
	}

	// Make sure we actually have a configuration object passed in.
	config = config || defaultConfig;

	// Fill in any gaps in the configuration with defaults.
	config.host    = config.host    || defaultConfig.host;
	config.port    = config.port    || defaultConfig.port;
	config.error   = config.error   || defaultConfig.error;
	config.resolve = config.resolve || defaultConfig.resolve;

	/**
	 * This is the actual middleware function.
	 */
	return function jarmoExpress(req, res, next) {
		// Should we use something like 'process.hrtime' for more accuracy?
		var start = Date.now();

		/**
		 * Get the data out of the request and response and send it to the
		 * configured server. Also make sure to remove listeners when done.
		 */
		function onResponseFinished() {
			// Resolve the payload from the 'request' and 'response' objects,
			// and send it to the Jarmo server, catching any errors.
			var payload = config.resolve(req, res, Date.now() - start);

			if(!payload) {
				// If the payload is falsy we don't send the data. This allows
				// for some ad hoc filtering with custom resolve functions.
				return removeListeners();
			}

			return send(config.host, config.port, payload, function(err) {
				if(err) {
					config.error(err);
				}
				return removeListeners();
			});
		}

		/**
		 * Clean up listeners to prevent any memory shenanigans.
		 */
		function removeListeners() {
			res.removeListener('error',  removeListeners);
			res.removeListener('close',  removeListeners);
			res.removeListener('finish', onResponseFinished);
		}

		res.once('error',  removeListeners);
		res.once('close',  removeListeners);
		res.once('finish', onResponseFinished);

		return next();
	}
}

/**
 * Default error handler function that is used if no 'error' handling function
 * is given in the configuration for the middleware.
 */
function defaultError(err) {
	console.log('[', new Date().toISOString(), ']',
		'Failed to send UDP packet(s),', err.message);
}

/**
 * Default function that is used if no 'resolve' is given in the configuration
 * for the middleware.
 */
function defaultResolve(req, res, duration) {
	return {
		response_time:   duration,
		response_status: res.statusCode || 0
	}
}

/**
 * Send data via UDP to the target server.
 *
 * @param {string} host     Server host.
 * @param {string} port     Server port.
 * @param {object} payload  Payload object, that will be made into a string,
 *                          and sent to the server.
 *
 * @return {Promise}  Promise for sending the payload.
 */
function send(host, port, payload, callback) {
	// Create a Buffer of the JSON stringified payload, so we can send it.
	var data = new Buffer(JSON.stringify(payload));

	// Resolve or reject the promise once the we have at least attempted to
	// send the payload. Should we add some sort of a retry on error?
	return client.send(data, 0, data.length, port, host, callback);
}
