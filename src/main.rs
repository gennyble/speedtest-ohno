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
	let ohno = Router::new().route("/speedtest/download", get(speedtest));

	let listen = TcpListener::bind("0.0.0.0:8000").await.unwrap();
	axum::serve(listen, ohno).await.unwrap();
}

async fn speedtest(wsu: WebSocketUpgrade) -> Response {
	wsu.on_upgrade(speedtest_ws)
}

async fn speedtest_ws(mut ws: WebSocket) {
	let chunks = 100;
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
		r#"{{ "chunkCount": {chunks}, "chunkSize": {chunkSize} }}"#,
	)))
	.await
	.unwrap();

	// and then start doing it
	for chunk_idx in 0..chunks {
		ws.send(Message::Binary(buff.clone())).await.unwrap();
	}

	while let Some(_msg) = ws.recv().await {
		println!("[ws::{id}] received message!");
		continue;
	}

	println!("[ws::{id}] stream closed!");
}
