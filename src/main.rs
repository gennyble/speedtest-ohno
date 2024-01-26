use std::{
	net::SocketAddr,
	str::FromStr,
	time::{Duration, Instant, SystemTime},
};

use axum::{
	extract::{
		ws::{Message, WebSocket},
		WebSocketUpgrade,
	},
	response::Response,
	routing::get,
	Router,
};
use axum_server::tls_rustls::RustlsConfig;
use rand::{Rng, SeedableRng};
use tokio::join;
use confindent::Confindent;

#[tokio::main]
async fn main() {
        let conf_path = std::env::args().nth(1).unwrap_or(String::from("/etc/sonic.conf"));
        let conf = match Confindent::from_file(&conf_path) {
            Err(e) => {
                eprintln!("error reading conf file at {conf_path}: {e}");
                std::process::exit(1);
            },
            Ok(conf) => {
                println!("successfully loaded conf at {conf_path}");
                conf
            }
        };

        let cert = conf.child_value("TlsCert");
        let pkey = conf.child_value("TlsPkey");
        let port: u16 = conf.child_parse("Port").unwrap();

	let ohno = Router::new()
		.route("/speedtest/download", get(speedtest))
		.route("/speedtest/ping", get(ping))
		.route("/speedtest/upload", get(upload));

	let addr = SocketAddr::from(([0, 0, 0, 0], port));
	let addr6: SocketAddr = std::net::SocketAddrV6::from_str(&format!("[::]:{port}"))
		.unwrap()
		.into();

	if pkey.is_some() {
		println!("using TLS encryption!");

		let rtls_config = RustlsConfig::from_pem_file(cert.unwrap(), pkey.unwrap())
			.await
			.unwrap();

		println!("listening on {addr}");
		let serve4 = axum_server::bind_rustls(addr, rtls_config.clone())
			.serve(ohno.clone().into_make_service());
		println!("listening on {addr6}");
		let serve6 = axum_server::bind_rustls(addr6, rtls_config).serve(ohno.into_make_service());

		let (res4, res6) = join!(serve4, serve6);
		res4.unwrap();
		res6.unwrap();
	} else {
		println!("listening on {addr}");
		let serve4 = axum_server::bind(addr).serve(ohno.clone().into_make_service());
		println!("listening on {addr6}");
		let serve6 = axum_server::bind(addr6).serve(ohno.into_make_service());

		let (res4, res6) = join!(serve4, serve6);
		res4.unwrap();
		res6.unwrap();
	}
}

const TEST_LENGTH: Duration = Duration::from_secs(15);
const CHUNK_SIZE: usize = 1024;

async fn speedtest(wsu: WebSocketUpgrade) -> Response {
	wsu.on_upgrade(speedtest_ws)
}

async fn speedtest_ws(mut ws: WebSocket) {
	// prepare for download
	let mut buff = vec![0u8; 1024 * CHUNK_SIZE];
	let mut rng = rand::rngs::StdRng::from_entropy();
	rng.fill(&mut buff[..]);

	let id: String = rng
		.sample_iter(&rand::distributions::Alphanumeric)
		.take(6)
		.map(char::from)
		.collect();

	// Tell the client what we're going to do
	ws.send(Message::Text(format!(
		r#"{{ "type": "download-start", "chunkSize": {CHUNK_SIZE} }}"#,
	)))
	.await
	.unwrap();

	// and then start doing it
	let mut chunks_sent = 0;
	let start = Instant::now();
	loop {
		ws.send(Message::Binary(buff.clone())).await.unwrap();
		chunks_sent += 1;

		if start.elapsed() >= TEST_LENGTH {
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

async fn upload(wsu: WebSocketUpgrade) -> Response {
	wsu.on_upgrade(upload_ws)
}

async fn upload_ws(mut ws: WebSocket) {
	let rng = rand::rngs::StdRng::from_entropy();
	let id: String = rng
		.sample_iter(&rand::distributions::Alphanumeric)
		.take(6)
		.map(char::from)
		.collect();

	let start_msg = format!(
		r#"{{ "type": "upload-start", "length": {}, "chunkSize": {CHUNK_SIZE} }}"#,
		TEST_LENGTH.as_secs()
	);

	println!("[ws::{id}] telling client to start upload test!");
	ws.send(Message::Text(start_msg)).await.unwrap();

	let mut start_time = None;
	let mut chunks_received = 0;

	while let Some(msg) = ws.recv().await {
		let msg = msg.unwrap();

		match msg {
			Message::Close(_) => {
				break;
			}
			Message::Binary(_) => {
				chunks_received += 1;

				match start_time {
					None => start_time = Some(SystemTime::now()),
					Some(start) if start.elapsed().unwrap() >= TEST_LENGTH => {
						let delta = start.elapsed().unwrap().as_millis();
						let stop_msg = format!(
							r#"{{ "type": "upload-stop", "chunkCount": {chunks_received}, "delta": {delta} }}"#
						);

						println!("[ws::{id}] telling client to stop upload test!");
						println!(
							"[ws::{id}] received {chunks_received} chunks of size {CHUNK_SIZE}. in {delta}ms"
						);
						ws.send(Message::Text(stop_msg)).await.unwrap();
					}
					_ => (),
				}
			}
			_ => (),
		}
	}

	println!("[ws::{id}] stream closed!");
}
