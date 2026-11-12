use reqwest::blocking::Client;
use serde_json::json;

pub struct Akari {
    url: String,
    client: Client,
}

impl Akari {
    pub fn new() -> Self {
        Self {
            url: "http://localhost:3000/run".to_string(),
            client: Client::new(),
        }
    }

    pub fn run(&self, code: &str) -> Result<(), Box<dyn std::error::Error>> {
        let res = self.client.post(&self.url)
            .json(&json!({ "code": code }))
            .send()?;

        if res.status().is_success() {
            println!("Akari script executed successfully.");
            Ok(())
        } else {
            let err: serde_json::Value = res.json()?;
            Err(format!("Akari error: {}", err["error"]).into())
        }
    }
}