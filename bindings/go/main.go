package main

import (
	"fmt"
	"log"

	akari "github.com/HvKOkla/Akari/bindings/go/akari"
)

func main() {
	fmt.Println("--- Test du pont Go ---")

	engine := akari.New()

	code := `
		let player = { "name": "Alice", "hp": 100 }
		say("Hello from Go, " + player.name)
	`

	err := engine.Run(code)
	if err != nil {
		log.Fatalf("Erreur : %v", err)
	}

	fmt.Println("Script Go envoyé avec succès !")
}