package akari

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Akari struct {
	URL string
}


func New() *Akari {
	return &Akari{
		URL: "http://localhost:3000/run",
	}
}


func (a *Akari) Run(code string) error {
	payload := map[string]string{"code": code}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("erreur d'encodage JSON : %w", err)
	}

	resp, err := http.Post(a.URL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("erreur d'envoi de la requête : %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erreur Akari (status %d) : %s", resp.StatusCode, string(body))
	}

	return nil
}