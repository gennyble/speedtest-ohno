onmessage = function (e) {
	console.log("[worker] received message from main!");

	const data = e.data;
	const kind = data["type"];

	if (kind === "startDownload") {
		downloadTest(data["server"]);
	} else {
		console.log("[worker] unrecognized message type " + kind);
	}
};

function downloadTest(server) {
	let running = false;
	let startTime = undefined;
	let chunkCount = 0;
	let remainingChunks = 0;
	let chunkSize = 0; // in kilobytes

	const socket = new WebSocket(`ws://${server}/speedtest/download`);

	socket.addEventListener("open", (event) => {
		console.log("[worker::ws] connection opened!");
	});

	socket.addEventListener("message", (event) => {
		console.log("[worker::ws] got message!");

		const msg = event.data;

		if (typeof msg === "string") {
			if (running) {
				console.log("didn't expect to receive text data while running test. bailing!");

				socket.close();
				postMessage("shutdown");
			} else {
				running = true;
				startTime = Date.now();

				const json_msg = JSON.parse(msg);
				chunkCount = json_msg["chunkCount"];
				remainingChunks = json_msg["chunkCount"];
				chunkSize = json_msg["chunkSize"];

				console.log(`[worker::ws] ${remainingChunks} chunks of size ${chunkSize}KB`);
			}
		} else {
			remainingChunks--;

			if (remainingChunks <= 0) {
				let stop = Date.now();
				let delta = stop - startTime;

				postMessage({
					"type": "doneDownload",
					"chunkCount": chunkCount,
					"chunkSize": chunkSize,
					"start": startTime,
					"stop": stop
				});
				socket.close();
			}
		}
	});
}

/*
data format:
{
	"chunkCount": number,
	"chunkSize": number // size in kilobytes
}
*/