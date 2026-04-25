package api

import (
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"ai-rpg-v2/internal/nanogpt"
	"ai-rpg-v2/internal/storage"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Config struct {
	APIKey       string
	StoryModel   string
	SupportModel string
	DataDir      string
	StaticDir    string // if set, serve frontend static files
}

type Handlers struct {
	cfg       *Config
	client    *nanogpt.Client
	sessions  *storage.SessionStore
	scenarios *storage.ScenarioStore
}

func NewRouter(cfg *Config) *chi.Mux {
	sessions, err := storage.NewSessionStore(cfg.DataDir)
	if err != nil {
		log.Fatalf("Failed to init session store: %v", err)
	}
	scenarios, err := storage.NewScenarioStore(cfg.DataDir)
	if err != nil {
		log.Fatalf("Failed to init scenario store: %v", err)
	}

	h := &Handlers{
		cfg:       cfg,
		client:    nanogpt.NewClient(cfg.APIKey),
		sessions:  sessions,
		scenarios: scenarios,
	}

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "X-Session-Id"},
		AllowCredentials: true,
	}))

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Get("/api/models", h.GetModels)
	r.Post("/api/generate", h.Generate)
	r.Post("/api/prompt/preview", h.PromptPreview)
	r.Post("/api/summarize", h.Summarize)
	r.Post("/api/update-stats", h.UpdateStats)
	r.Post("/api/transform", h.Transform)
	r.Post("/api/tts", h.TextToSpeech)

	r.Get("/api/image-models", h.GetImageModels)
	r.Post("/api/images/generate", h.GenerateImages)
	r.Post("/api/images/enhance-prompt", h.EnhanceImagePrompt)
	r.Post("/api/lore/generate", h.GenerateLore)
	r.Post("/api/suggest-name", h.SuggestName)

	r.Get("/api/state", h.GetState)
	r.Put("/api/state", h.PutState)
	r.Delete("/api/state", h.DeleteState)
	r.Post("/api/state/export", h.ExportState)
	r.Post("/api/state/import", h.ImportState)
	r.Post("/api/data/reset", h.ResetAllData)

	r.Get("/api/sessions", h.ListSessions)
	r.Post("/api/sessions", h.CreateSession)
	r.Patch("/api/sessions/{id}", h.RenameSession)
	r.Delete("/api/sessions/{id}", h.DeleteSession)
	r.Put("/api/sessions/current", h.SwitchSession)

	r.Get("/api/scenarios", h.ListScenarios)
	r.Post("/api/scenarios", h.CreateScenario)
	r.Get("/api/scenarios/{id}", h.GetScenario)
	r.Patch("/api/scenarios/{id}", h.UpdateScenario)
	r.Delete("/api/scenarios/{id}", h.DeleteScenario)

	// Serve frontend static files in production
	if cfg.StaticDir != "" {
		staticFS := http.Dir(cfg.StaticDir)
		fileServer := http.FileServer(staticFS)

		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Try to serve the file directly
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}
			fullPath := filepath.Join(cfg.StaticDir, path)
			if _, err := os.Stat(fullPath); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
			// SPA fallback: serve index.html for unknown routes
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}

// spaFileSystem wraps http.FileSystem to fall back to index.html for SPA routing.
type spaFileSystem struct {
	root http.FileSystem
}

func (s spaFileSystem) Open(name string) (http.File, error) {
	f, err := s.root.Open(name)
	if os.IsNotExist(err) {
		return s.root.Open("index.html")
	}
	return f, err
}

var _ fs.File = (*os.File)(nil) // compile check
