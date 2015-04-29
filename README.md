# Jarmo Express
Simple middleware to integrate Jarmo to your ExpressJS application.

## Options
The available options are listed here, for the defaults you can check the
source code.
```
host     Host of the Jarmo server
port     Port of the Jarmo server
error    Error callback function, called if there is a problem sending the
         data to Jarmo server.
resolve  Resolve is used to 'resolve' the payload to be sent to the server,
         refer to the example below to see the signature for this function.
```
Note that the middleware is pass through by default and doesn't actually do
anything. Enable it by setting the `JARMO_ENABLE` environmental variable.

## Example
```javascript
import jarmo   from 'jarmo-express';
import express from 'express';

var app = express();

/**
 * Custom resolve to get the necessary data from 'request' and 'response'
 * objects.
 */
function resolve(req, res, duration) {
	return {
	    host:            process.env.HOSTNAME,
	    path:            req.route.path,
		response_time:   duration,
		response_status: res.statusCode
	}
}

// If we want the middleware to actually send the data to the Jarmo server,
// we need to make sure to have the JARMO_ENABLE environmental variable set.
app.use(jarmo({ resolve: resolve }));

// ...
```
