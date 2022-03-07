# Turbo
Modular, lightweight HTTP server cabpable of extreme low response times. Plugins listed below are included.

If you would like to contribute code, make a pull request

***To request a feature or report a bug, use the Issues tab. I will try to get it implemented/fixed ASAP.***
###### May not be suitable for release/production. I will try to make this as secure and efficient as possible.

## Todo
* Method for adding types to mime_types.js
* HTTPS functionality?
* Custom error pages?
* Logging?

## Plugins
* Static server (static), params: { root = __dirname }
###### More plugins coming soon

## Extra files
Turbo comes with some extra files used internally, but suitable for use externally.
* mime_types.js : Dictionary of common MIME types indexed by extension (without ".")
* status_codes.js : Dictionary of HTTP response status codes indexed by code eg. (statusCodes[404] === "Not Found")

## Usage
```javascript
const turbo = require("./<path to turbo folder>/http");

/**
 * @property {Number} timeout : The inactivity timeout in seconds, after which the server will close the socket's connection
 * @property {Number} maxRequests : The maximum amount of requests a socket may make in its lifetime
 * @property {JSON} plugins : List a plugin id here to activate it. The value should be an object, with all plugin parameters optional.
 */
const server = new turbo.HTTPServer({
  plugins: {
    static: {}
  }
}).listen(80);
```