package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"ai-rpg-v2/internal/game"
)

const stateFile = "state.json"

type FileStore struct {
	dir string
}

func NewFileStore(dir string) (*FileStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	return &FileStore{dir: dir}, nil
}

func (s *FileStore) path() string {
	return filepath.Join(s.dir, stateFile)
}

// Load reads the game state from disk. Returns default state if file doesn't exist.
func (s *FileStore) Load() (*game.GameState, error) {
	data, err := os.ReadFile(s.path())
	if err != nil {
		if os.IsNotExist(err) {
			return game.DefaultState(), nil
		}
		return nil, fmt.Errorf("read state: %w", err)
	}

	var state game.GameState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("unmarshal state: %w", err)
	}
	return &state, nil
}

// Save writes the game state to disk.
func (s *FileStore) Save(state *game.GameState) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}
	if err := os.WriteFile(s.path(), data, 0644); err != nil {
		return fmt.Errorf("write state: %w", err)
	}
	return nil
}

// Delete removes the state file (new adventure).
func (s *FileStore) Delete() error {
	err := os.Remove(s.path())
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete state: %w", err)
	}
	return nil
}

// ExportJSON returns the state as formatted JSON bytes.
func (s *FileStore) ExportJSON() ([]byte, error) {
	state, err := s.Load()
	if err != nil {
		return nil, err
	}
	state.Format = "ai-rpg-nano-v1"
	return json.MarshalIndent(state, "", "  ")
}

// ImportJSON loads a state from JSON bytes and saves it.
func (s *FileStore) ImportJSON(data []byte) (*game.GameState, error) {
	var state game.GameState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("unmarshal import: %w", err)
	}
	if err := s.Save(&state); err != nil {
		return nil, err
	}
	return &state, nil
}
