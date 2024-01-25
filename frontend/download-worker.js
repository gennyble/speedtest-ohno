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
	let start_time = undefined;
	let chunk_size = 0; // in kilobytes
	let chunk_count = 0;

	const socket = new WebSocket(`wss://${server}/speedtest/download`);

	socket.addEventListener("open", (event) => {
		console.log("[worker::ws] download connection opened!");
	});

	let report_task = setInterval(() => {
		let current_time = Date.now();
		let delta = current_time - start_time;

		postMessage({
			"type": "download-progress",
			"delta": delta,
			"chunkCount": chunk_count,
			"chunkSize": chunk_size
		});
	}, 100);

	socket.addEventListener("message", (event) => {
		const msg = event.data;

		if (typeof msg === "string") {
			const json = JSON.parse(msg);

			if (json["type"] === "download-start") {
				start_time = Date.now();
				chunk_size = json["chunkSize"];

				console.log(`[worker::ws] starting download! chunk_size ${chunk_size}KB`);
			} else if (json["type"] === "download-stop") {
				let stop_time = Date.now();
				socket.close();

				clearInterval(report_task);
				postMessage({
					"type": "download-stop",
					"chunkCount": chunk_count,
					"chunkSize": chunk_size,
					"delta": stop_time - start_time,
				});
			}
		} else {
			chunk_count++;
		}
	});
}
