const net = require("net");
const plugins = require("./plugins");
const statusCodes = require("./status_codes");

function emptyRequestListener(request, response) {
	return response;
}

class Server extends net.Server {
	constructor(options = {}) {
		super();

		this.timeout = options.timeout || 5;
		this.maxRequests = options.maxRequests || 32;
		this.pluginConfig = options.plugins || { "static": {} };
		this.customRequestListener = options.onrequest || emptyRequestListener;

		// Get ready to recieve connections
		this.on("connection", this.#onConnection);
	}
	#sendResponse(socket, status, headers, data) {
		// Set default headers
		var rawHeaders = `HTTP/1.1 ${status} ${statusCodes[status]}\r\nServer: Turbo HTTP\r\nX-Powered-By: elektromechanic.com/turbo\r\nDate: ${new Date().toUTCString()}`;
		
		// Add each header in the JSON dictionary to rawHeaders in HTTP/CRLF forma
		Object.keys(headers).forEach((name) => {
			rawHeaders += `${name}: ${headers[name]}\r\n`;
		});
	
		// Send! (Also ends writable side of socket)
		socket.end(`${rawHeaders}\r\n${data}`);
	}
	#error(socket, code = 500, trace = 0, retry = 0) {
		const headers = { "Connection": "close", "Content-Type": "text/plain" };
		if(retry) headers["Retry-After"] = retry;

		// Error message eg. "404 Not Found: /index.html"
		const message = `${code} ${statusCodes[code] || "Unknown"}: ${trace || socket.remoteAddress}`;
		
		// Send response
		this.#sendResponse(socket, code, headers, message);
		// Destroy the socket and prevent further transmission on this socket
		socket.destroy();
	}
	#onData(socket, rawRequest) {
		// data[0] is headers and data[1] is any request data, usually empty
		const data = rawRequest.toString().split("\r\n\r\n");
	
		// Headers as HTTP/CRLF format string
		const rawHeaders = data[0].split("\r\n");
	
		/**
		 * @property {String} command the HTTP command; eg. "GET / HTTP/1.1"
		 * @property {Array} commandArgs command, split by " "; eg. [ "GET", "/", "HTTP/1.1" ]
		 * @property {String} method the HTTP request method; eg. "GET"
		 * @property {String} url path requested by the client; eg. "/"
		 * @property {String} httpVersion the version of HTTP used to send the request; eg. "HTTP/1.1"
		 * @property {Object} headers dictionary of HTTP headers sent with the request
		 * @property {String} data the data sent with the request usually empty; eg. ""
		 */
		const request = {};
		request.command = rawHeaders[0];
		request.commandArgs = request.command.split(" ");
		request.method = request.commandArgs[0];
		request.url = request.commandArgs[1];
		request.httpVersion = request.commandArgs[2];
		request.headers = {};
		request.data = data[1];
		
		// Parse headers into JSON dictionary
		rawHeaders.forEach((value, index) => {
			// Skip putting request.command in request.headers
			if(index !== 0) {
				value = value.split(": ");
				request.headers[value[0]] = value[1];
			}
		});

		// Request syntax error
		if(
			data.length !== 2 ||
			rawHeaders.length === 0 ||
			request.commandArgs.length !== 3 ||
			!request.url.startsWith("/")
		) this.#error(socket, 400, request.url);

		/**
		 * @property {Number} status the HTTP response status code
		 * @property {Object} headers a dictionary of HTTP response header values
		 * @property {String|Buffer} data data to be sent back to the client
		 * @property {String} trace? OPTIONAL; if error is true, this will be displayed in the response
		 * @property {Number} retry? OPTIONAL; time, in seconds to be passed as Retry-After header
		 */
		var response = {
			status: 200,
			headers: {
				"Connection": request.headers["Connection"] || "close"
			},
			data: "No Data",
			trace: request.url
		}

		// If we shouldn't close the connection, send inactivity timeout and max requests
		if(response.headers["Connection"] === "keep-alive") response.headers["Keep-Alive"] = `timeout=${this.timeout}, max=${this.maxRequests}`;

		// Run plugins one by one
		Object.keys(this.pluginConfig).forEach((name) => {
			if(plugins[name]) {
				response = plugins[name](this.pluginConfig[name], request, response) || response;
			}
		});

		response = this.customRequestListener(request, response) || response;

		// If response is not 200 OK, send response as an error
		if(response.status !== 200) {
			this.#error(socket, response.status || 500, response.trace || request.url, response.retry || 0);
		} else {
			this.#sendResponse(socket, response.status, response.headers, response.data);
		}
	}
	#onConnection(socket) {
		socket.requests = 0;
		// setTimeout accepts ms, not s
		socket.setTimeout(this.timeout * 1000);
		socket.on("timeout", () => {
			this.#error(socket, 408);
		});
		socket.on("data", (data) => {
			socket.requests++;
			// Enforce max requests
			if(socket.requests > this.maxRequests) {
				this.#error(socket, 429, socket.remoteAddress, this.timeout);
			} else {
				// Handle request
				this.#onData(socket, data);
			}
		});
	}
}

module.exports = {
	"HTTPServer": Server
}