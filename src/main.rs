use std::time::{Duration, Instant};

use axum::{
	extract::{
		ws::{Message, WebSocket},
		WebSocketUpgrade,
	},
	response::Response,
	routing::get,
	Router,
};
use rand::{Rng, SeedableRng};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
	let ohno = Router::new()
		.route("/speedtest/download", get(speedtest))
		.route("/speedtest/ping", get(ping));

	let listen = TcpListener::bind("0.0.0.0:8000").await.unwrap();
	axum::serve(listen, ohno).await.unwrap();
}

async fn speedtest(wsu: WebSocketUpgrade) -> Response {
	wsu.on_upgrade(speedtest_ws)
}

async fn speedtest_ws(mut ws: WebSocket) {
	let testLength = Duration::from_secs(15);
	let chunkSize = 1024;

	// prepare for download
	let mut buff = vec![0u8; 1024 * chunkSize];
	let mut rng = rand::rngs::StdRng::from_entropy();
	rng.fill(&mut buff[..]);

	let id: String = rng
		.sample_iter(&rand::distributions::Alphanumeric)
		.take(6)
		.map(char::from)
		.collect();

	// Tell the client what we're going to do
	ws.send(Message::Text(format!(
		r#"{{ "type": "download-start", "chunkSize": {chunkSize} }}"#,
	)))
	.await
	.unwrap();

	// and then start doing it
	let mut chunks_sent = 0;
	let start = Instant::now();
	loop {
		ws.send(Message::Binary(buff.clone())).await.unwrap();
		chunks_sent += 1;

		if start.elapsed() >= testLength {
			println!("[ws::{id}] is done testing. sent {chunks_sent} chunks!");
			break;
		}
	}

	// Let them know we're done
	ws.send(Message::Text(String::from(
		r#"{ "type": "download-stop" }"#,
	)))
	.await
	.unwrap();

	while let Some(_msg) = ws.recv().await {
		println!("[ws::{id}] received message!");
		continue;
	}

	println!("[ws::{id}] stream closed!");
}

async fn ping(wsu: WebSocketUpgrade) -> Response {
	wsu.on_upgrade(ping_ws)
}

async fn ping_ws(mut ws: WebSocket) {
	let rng = rand::rngs::StdRng::from_entropy();
	let id: String = rng
		.sample_iter(&rand::distributions::Alphanumeric)
		.take(6)
		.map(char::from)
		.collect();

	while let Some(msg) = ws.recv().await {
		let msg = msg.unwrap();

		match msg {
			Message::Close(_) => {
				break;
			}
			msg => {
				ws.send(msg).await.unwrap();
			}
		}
	}

	println!("[ws::{id}] stream closed!");
}
