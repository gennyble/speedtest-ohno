function run() {
	let worker = new Worker("worker.js");

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