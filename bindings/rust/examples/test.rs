use akari_rs::Akari;

fn main() {
    let akari = Akari::new();
    let code = r#"
        let player = { "name": "Quentin", "hp": 100 }
        say("Hello from Rust, " + player.name)
    "#;
    
    match akari.run(code) {
        Ok(_) => println!("Script sent!"),
        Err(e) => eprintln!("Error: {}", e),
    }
}