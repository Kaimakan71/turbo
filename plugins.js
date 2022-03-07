const fs = require("fs");
const mimeTypes = require("./mime_types");

module.exports = {
	"static": (config, request, response) => {
		// Prevent client from seeing non-public files/folders
		request.url = request.url.replace("../", "");
		const dirs = request.url.split("/");
		// Serve index.html
		if(request.url.endsWith("/")) {
			request.url += "index.html";
		} else if(!dirs[dirs.length - 1].includes(".")) {
			request.url += "/index.html";
		}
		const dots = request.url.split(".");
		const localPath = (config.root || __dirname) + request.url;

		// Serve 404 errors
		if(fs.existsSync(localPath)) {
			// File found! serve to user
			const data = fs.readFileSync(localPath);
			// Set MIME type
			response.headers["Content-Type"] = mimeTypes[dots[dots.length - 1]] || "application/octet-stream";
			response.data = data || "No Content";
		} else {
			// Error!
			response.status = 404;
			response.trace = request.url;
		}

		return response;
	}
}