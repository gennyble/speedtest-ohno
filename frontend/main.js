// in Mbits
const speedTiers = [
	// up to 1Megabit
	[0, 1],
	// up to 10 Megabit
	[1, 10],
	// up to 50 Megabit
	[10, 50],
	// up to 100 Megabit
	[50, 100],
	// up to 500 Megabit
	[100, 500],
	// up to 1Gbit (max any connection I have access to)
	[500, 1000],
	// up to 2.5Gbit
	[1000, 2500],
	// up to 5Gbit
	[2500, 5000],
	// up to 10Gbit
	[5000, 10000],
	// up to 100Gbit (this will never be used)
	[10000, 100000]
];

const server = "sonic.nyble.dev:1256";

let worker = undefined;

const startButton = {
	'button': document.getElementById('start-button'),
	'initial-text': document.getElementById('start-button').innerText,
	'running-text': 'running some tests...',
	'retest-text': 'do it again?'
};

const download = {
	'speed': document.getElementById('download-speed'),
	'meter': document.getElementById('download-meter-inner'),
	'range-low': document.getElementById('download-range-low'),
	'range-high': document.getElementById('download-range-high')
};
const upload = {
	'speed': document.getElementById('upload-speed'),
	'meter': document.getElementById('upload-meter-inner'),
	'range-low': document.getElementById('upload-range-low'),
	'range-high': document.getElementById('upload-range-high')
};
const ping = document.getElementById('ping');

const ping_buffer = new Array();

function run() {
	startButton.button.setAttribute('disabled', 'true');
	startButton.button.innerText = startButton["running-text"];
	runDownload();
}

function runDownload() {
	worker = new Worker("download-worker.js");
	worker.postMessage({ "type": "startDownload", "server": server });
	worker.addEventListener("message", messageHandler);
}

function runUpload() {
	worker = new Worker("upload-worker.js");
	worker.postMessage({ "type": "startUpload", "server": server });
	worker.addEventListener("message", messageHandler);
}

function runPing() {
	worker = new Worker("ping-worker.js");
	worker.postMessage({ "type": "startPing", "server": server });
	worker.addEventListener("message", messageHandler);
}

function finishup() {
	startButton.button.innerText = startButton["retest-text"];
	startButton.button.removeAttribute('disabled');
}

function messageHandler(event) {
	const msg = event.data;
	const kind = msg["type"];

	let runNext = undefined;

	switch (kind) {
		case 'download-stop':
			console.log("stopped download test");
			runNext = runUpload;
			worker.terminate(); //fallthrough
		case 'download-progress':
			displayThroughput(msg, download);
			break;
		case 'upload-stop':
			console.log("stopped upload test");
			runNext = runPing;
			worker.terminate(); //fallthrough
		case 'upload-progress':
			displayThroughput(msg, upload);
			break;
		case 'ping-stop':
			console.log("stopped ping");
			runNext = finishup;
			displayPing(fullPingAverage(), ping);
			worker.terminate();
			break;
		case 'ping-progress':
			ping_buffer.push(msg["roundtrip"]);
			displayPing(runningPingAverage(), ping);
			break;
	}

	if (runNext) {
		setTimeout(runNext, 500);
	}
}

let previous_range = undefined;

function pickBestRange(speedMib) {
	// To move up a range you have to be greater than ten percent of the
	// maximum. This is an attempt at debounce so they don't rapidly switch
	// back and forth.
	if (previous_range) {
		let tenPercent = (previous_range[1] - previous_range[0]) * 0.1;
		if (speedMib > previous_range[1] && speedMib < previous_range[1] + tenPercent) {
			return previous_range;
		}
	}

	// Look for the first range the speed falls within
	for (const range of speedTiers) {
		if (range[0] < speedMib && range[1] > speedMib) {
			previous_range = range;
			return range;
		}
	}

	// As a failsafe return the lowest range
	return speedTiers[0];
}

function displayThroughput(msg, display) {
	let count = msg["chunkCount"];
	let size = msg["chunkSize"];
	let delta = msg["delta"];

	let total_transfer_kbi = size * count * 8;
	let total_transfer_mbi = total_transfer_kbi / 1024;
	let throughput = (total_transfer_mbi / (delta / 1000)).toFixed(1);

	display.speed.innerText = `${throughput} Mbps`;

	let range = pickBestRange(throughput);
	let percent = ((throughput - range[0]) / (range[1] - range[0])) * 100;
	display["range-low"].innerText = range[0] + " Mbps";
	display["range-high"].innerText = range[1] + " Mbps";
	display.meter.style.width = `${Math.min(percent, 100)}%`;
}

function runningPingAverage() {
	let count = Math.min(ping_buffer.length, 5);
	let sum = 0;
	for (let i = 0; i < count; ++i) {
		sum += ping_buffer[ping_buffer.length - count + i];
	}

	return (sum / count).toFixed(0);
}

function fullPingAverage() {
	let count = ping_buffer.length;
	let sum = ping_buffer.reduce((acc, v) => acc + v, 0);
	return (sum / count).toFixed(0);
}

function displayPing(number, display) {
	display.innerText = number + "ms";
}
