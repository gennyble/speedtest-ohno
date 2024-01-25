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

function uploadTest(server) {
	const socket = new WebSocket(`ws://${server}/speedtest/upload`);

	socket.addEventListener("open", (event) => {
		console.log("[worker::ws] connection opened!");
	});

	let buffer = undefined;
	let test_running = false;
	let chunk_size = 0;
	let test_length = 0;
	let test_started = undefined;
	let sent_chunks = 0;

	setInterval(() => {
		console.log(`${sent_chunks} - ${socket.bufferedAmount}`);
	}, 500);

	let timeout_handle = undefined;
	let try_send = () => {
		if (!test_running) {
			return;
		}

		if (Date.now() - test_started > test_length * 1000) {
			console.log("stopped from running overtime!");
			test_running = false;
		}

		if (socket.bufferedAmount > buffer.length) {
			console.log(`${socket.bufferedAmount} in buffer, waiting 10ms`);
			timeout_handle = setTimeout(() => { try_send() }, 10);
		} else {
			socket.send(buffer);
			sent_chunks++;
			try_send();
		}
	};

	socket.addEventListener("message", (event) => {
		console.log("[worker::ws] got message!");

		console.log(event.data);
		const json = JSON.parse(event.data);
		if (json["type"] === "upload-start") {
			chunk_size = json["chunkSize"];
			// the server tells us to stop, but we don't want to just keep sending.
			test_length = json["length"] + 2;
			test_running = true;
			test_started = Date.now();

			console.log("[worker] making random data...");
			buffer = new Uint8Array(1024 * chunk_size);
			for (let i = 0; i < buffer.length; ++i) {
				buffer[i] = Math.floor(Math.random() * 256);
			}
			console.log("[worker] made data!");

			try_send();
		} else if (json["type"] === "upload-stop") {
			test_running = false;
			let chunk_count = json["chunkCount"];
			let delta = json["delta"];

			postMessage({ "type": "upload-stop", "chunkSize": chunk_size, "chunkCount": chunk_count, "delta": delta });
			socket.close();
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