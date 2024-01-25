onmessage = function (e) {
	console.log("[worker] received message from main!");

	const data = e.data;
	const kind = data["type"];

	if (kind === "startPing") {
		pingTest(data["server"]);
	} else {
		console.log("[worker] unrecognized message type " + kind);
	}
};

function pingTest(server) {
	const socket = new WebSocket(`ws://${server}/speedtest/ping`);

	let iterations = 100;

	let sendPing = () => {
		setTimeout(() => {
			let message = { "time": Date.now() };
			socket.send(JSON.stringify(message));
		}, 50);
	};

	socket.addEventListener("message", (event) => {
		let receive_time = Date.now();
		const json = JSON.parse(event.data);
		const time = json["time"];
		let roundtrip = receive_time - time;

		postMessage({ "type": "ping-progress", "roundtrip": roundtrip });

		if (iterations <= 0) {
			socket.close();
			postMessage({ "type": "ping-stop" });
		} else {
			iterations--;
			sendPing();
		}
	});

	socket.addEventListener("open", () => {
		postMessage({ "type": "ping-start" });
		sendPing();
	});
}