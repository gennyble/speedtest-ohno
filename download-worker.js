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

	const socket = new WebSocket(`ws://${server}/speedtest/download`);

	socket.addEventListener("open", (event) => {
		console.log("[worker::ws] connection opened!");
	});

	let report_task = setInterval(() => {
		let current_time = Date.now();

		postMessage({
			"type": "download-progress",
			"start": start_time,
			"current": current_time,
			"chunkCount": chunk_count,
			"chunkSize": chunk_size
		});
	}, 250);

	socket.addEventListener("message", (event) => {
		console.log("[worker::ws] got message!");

		const msg = event.data;

		if (typeof msg === "string") {
			console.log(msg);
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
					"start": start_time,
					"stop": stop_time
				});
			}
		} else {
			chunk_count++;
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