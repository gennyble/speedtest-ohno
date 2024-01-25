function run() {
	let worker = new Worker("download-worker.js");

	worker.postMessage({ "type": "startDownload", "server": "192.168.1.28:8000" });

	worker.addEventListener("message", (event) => {
		const data = event.data;

		if (data["type"] === "download-stop") {
			console.log("temrinating worker!");
			worker.terminate();

			let count = data["chunkCount"];
			let size = data["chunkSize"];
			let start = data["start"];
			let stop = data["stop"];

			let delta = stop - start;
			let delta_seconds = (delta / 1000).toFixed(1);

			// in kilobits
			let total_transfer = size * count * 8;
			let total_transfer_mbi = total_transfer / 1024;
			let throughput = (total_transfer_mbi / (delta / 1000)).toFixed(1);

			console.log("Done!");
			console.log(`received ${count} chunks of ${size}KB in ${delta_seconds}`);
			console.log(`gives a throughput of ${throughput} Mbps`);
		} else if (data["type"] === "download-progress") {
			let count = data["chunkCount"];
			let size = data["chunkSize"];
			let delta = data["current"] - data["start"];
			let delta_seconds = (delta / 1000).toFixed(1);

			// in kilobits
			let total_transfer = size * count * 8;
			let total_transfer_mbi = total_transfer / 1024;
			let throughput = (total_transfer_mbi / (delta / 1000)).toFixed(1);

			let speed = document.getElementById('speed');
			speed.innerText = `${throughput} Mbps`;

			console.log(`${delta_seconds}s - ${throughput} Mbps`);
		}
	});
}

function runPing() {
	let worker = new Worker("ping-worker.js");

	worker.postMessage({ "type": "startPing", "server": "192.168.1.28:8000" });

	worker.addEventListener("message", (event) => {
		const msg = event.data;
		const kind = msg["type"];

		if (kind === "ping-start") {
			console.log("started ping test");
		} else if (kind === "ping-progress") {
			let roundtrip = msg["roundtrip"];
			console.log(`${roundtrip}ms`);
		} else if (kind === "ping-stop") {
			console.log("stopped ping test");
			worker.terminate();
		}
	});
}