onmessage = function (e) {
	console.log("[worker] received message from main!");

	const data = e.data;
	const kind = data["type"];

	if (kind === "startUpload") {
		uploadTest(data["server"]);
	} else {
		console.log("[worker] unrecognized message type " + kind);
	}
};

let socket = undefined;

let test_running = false;
let buffer = undefined;
let chunk_size = 0;
let test_length = 0;
let start_time = undefined;
let sent_chunks = 0;
let report_task = undefined;

function uploadTest(server) {
	socket = new WebSocket(`ws://${server}/speedtest/upload`);

	socket.addEventListener("open", (event) => {
		console.log("[worker::ws] upload connection opened!");
	});

	socket.addEventListener("message", (event) => {
		const json = JSON.parse(event.data);

		if (json["type"] === "upload-start") {
			chunk_size = json["chunkSize"];
			// the server tells us to stop, but we don't want to just keep
			// sending in case of extreme latency. it's a failsafe.
			test_length = json["length"] + 2;
			test_running = true;
			start_time = Date.now();

			make_data();
			try_send();
			start_report();
		} else if (json["type"] === "upload-stop") {
			test_running = false;
			let chunk_count = json["chunkCount"];
			let delta = json["delta"];

			// the server gives us the final chunk count and delta value. the
			// global values are used for progress reports.
			postMessage({ "type": "upload-stop", "chunkSize": chunk_size, "chunkCount": chunk_count, "delta": delta });
			socket.close();
		}
	});
}

function try_send() {
	if (!test_running) {
		return;
	}

	if (Date.now() - start_time > test_length * 1000) {
		console.log("[worker] stopped from running overtime!");
		test_running = false;
	}

	// waiting until the buffer is empty worries me in a "that'll throttle
	// the connection" kind of way. I'm sure this will, too, but it'll have
	// less of a chance probably. keeps it stocked with at least one chunk.
	if (socket.bufferedAmount > buffer.length) {
		setTimeout(() => { try_send() }, 10);
	} else {
		socket.send(buffer);
		sent_chunks++;
		try_send();
	}
}

function make_data() {
	buffer = new Uint8Array(1024 * chunk_size);
	for (let i = 0; i < buffer.length; ++i) {
		buffer[i] = Math.floor(Math.random() * 256);
	}
}

function start_report() {
	report_task = setInterval(() => {
		let current_time = Date.now();

		postMessage({
			"type": "upload-progress",
			"delta": current_time - start_time,
			"chunkCount": sent_chunks,
			"chunkSize": chunk_size
		});
	}, 100);
}