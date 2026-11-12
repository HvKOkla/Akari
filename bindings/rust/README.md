
# Akari for Rust (`akari-rs`)

A safe, embeddable scripting language for your Rust app.
Sandboxed by default. No I/O, no network, no crashes.

## Why Akari?

Lua is 30 years old. JavaScript's `eval()` is a security nightmare. WASM is too low-level.

If you want to add **user scripting** to your game server, editor, or SaaS backend (written in Rust), you need something **safe** by default. Akari runs in an isolated Node.js worker, so your Rust process never crashes and never gets hijacked.

## How it works

This crate is a lightweight HTTP client. It sends the Akari script to a local Node.js server (the Akari sandbox), which executes it securely and returns the result.

## Prerequisites

You need the Akari Node.js engine running locally.

1. Clone the Akari repository: `git clone https://github.com/HvKOkla/Akari.git`
2. Install dependencies: `npm install`
3. Build the engine: `npm run build`
4. Start the Rust bridge server: `node bindings/rust/server.js`

## Usage

Add this to your `Cargo.toml`:

```toml
[dependencies]
akari-rs = "1.0.0"
```

Then, in your Rust code:

```rust
use akari_rs::Akari;

fn main() {
    let akari = Akari::new();
    
    let code = r#"
        let player = { "name": "Quentin", "hp": 100 }
        say("Hello from Rust, " + player.name)
    "#;
    
    match akari.run(code) {
        Ok(_) => println!("Script executed successfully!"),
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

## Security

- **Impitoyable Checker**: Blocks `process`, `require`, `eval`, and prototype pollution *before* compilation.
- **Worker Sandbox**: Scripts run in an isolated Node.js thread with strict memory limits (16MB) and timeouts (1s).
- **Red Team Tested**: 8 hacker attacks (injection, infinite loops, system access) are successfully blocked.

## License

Apache-2.0
```