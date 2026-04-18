package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"ai-rpg-v2/internal/game"
)

const legacyStateFile = "state.json"
const legacyBackupFile = "state.json.migrated-v3.bak"

// MigrateLegacyState moves a pre-v3 single-file state into the sessions directory,
// sets it as current, and renames the old file to a .bak. Idempotent: does nothing
// if sessions/ already has any files, or if state.json is absent.
func MigrateLegacyState(root string, store *SessionStore) error {
	legacyPath := filepath.Join(root, legacyStateFile)
	if _, err := os.Stat(legacyPath); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(store.sessionsPath())
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() && e.Name() != "" {
				// sessions already exist — skip migration
				return nil
			}
		}
	}

	data, err := os.ReadFile(legacyPath)
	if err != nil {
		return fmt.Errorf("read legacy state: %w", err)
	}

	var st game.GameState
	if err := json.Unmarshal(data, &st); err != nil {
		return fmt.Errorf("parse legacy state: %w", err)
	}

	st.SessionID = newID()
	if st.Name == "" {
		st.Name = "Adventure"
	}
	now := time.Now().Unix()
	if st.CreatedAt == 0 {
		st.CreatedAt = now
	}
	st.LastPlayedAt = now
	st.Migrate()

	if err := store.writeState(&st); err != nil {
		return fmt.Errorf("write migrated session: %w", err)
	}
	if err := store.SetCurrent(st.SessionID); err != nil {
		return fmt.Errorf("set current: %w", err)
	}

	backupPath := filepath.Join(root, legacyBackupFile)
	if err := os.Rename(legacyPath, backupPath); err != nil {
		// Non-fatal: session was created successfully.
		fmt.Printf("warn: could not rename legacy state.json to backup: %v\n", err)
	}
	return nil
}
