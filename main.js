function run() {
	let worker = new Worker("worker.js");

	worker.postMessage({ "type": "startDownload", "server": "192.168.1.28:8000" });

	worker.addEventListener("message", (event) => {
		const data = event.data;

		if (data["type"] === "doneDownload") {
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

			console.log(`received ${count} chunks of ${size}KB in ${delta_seconds}`);
			console.log(`gives a throughput of ${throughput} Mbps`);
		}
	});
}