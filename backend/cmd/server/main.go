package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"ai-rpg-v2/internal/api"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}

	apiKey := os.Getenv("NANOGPT_API_KEY")
	storyModel := os.Getenv("STORY_MODEL")
	supportModel := os.Getenv("SUPPORT_MODEL")
	staticDir := os.Getenv("STATIC_DIR")

	cfg := &api.Config{
		APIKey:       apiKey,
		StoryModel:   storyModel,
		SupportModel: supportModel,
		DataDir:      dataDir,
		StaticDir:    staticDir,
	}

	r := api.NewRouter(cfg)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
