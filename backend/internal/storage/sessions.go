package storage

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"ai-rpg-v2/internal/game"
)

const (
	sessionsDir = "sessions"
	currentFile = "current.json"
	sessionPrefix = "ses_"
)

var ErrNoCurrent = errors.New("no current session")
var ErrNotFound = errors.New("session not found")

type SessionStore struct {
	root string
}

type currentPointer struct {
	ID string `json:"id"`
}

// SessionMeta is the lightweight header returned by List.
type SessionMeta struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	CreatedAt    int64  `json:"createdAt"`
	LastPlayedAt int64  `json:"lastPlayedAt"`
	OverviewHead string `json:"overviewHead,omitempty"`
	StoryChars   int    `json:"storyChars"`
}

func NewSessionStore(root string) (*SessionStore, error) {
	if err := os.MkdirAll(filepath.Join(root, sessionsDir), 0755); err != nil {
		return nil, fmt.Errorf("create sessions dir: %w", err)
	}
	return &SessionStore{root: root}, nil
}

func (s *SessionStore) sessionsPath() string {
	return filepath.Join(s.root, sessionsDir)
}

func (s *SessionStore) filePath(id string) string {
	return filepath.Join(s.sessionsPath(), id+".json")
}

func (s *SessionStore) currentPath() string {
	return filepath.Join(s.root, currentFile)
}

// newID returns a new session id using current unix time in ms.
func newID() string {
	return fmt.Sprintf("%s%d", sessionPrefix, time.Now().UnixNano()/1e6)
}

func (s *SessionStore) List() ([]SessionMeta, error) {
	entries, err := os.ReadDir(s.sessionsPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []SessionMeta{}, nil
		}
		return nil, fmt.Errorf("read sessions dir: %w", err)
	}

	metas := make([]SessionMeta, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(e.Name(), ".json")
		st, err := s.Get(id)
		if err != nil {
			continue
		}
		metas = append(metas, metaFromState(st))
	}

	sort.Slice(metas, func(i, j int) bool {
		return metas[i].LastPlayedAt > metas[j].LastPlayedAt
	})
	return metas, nil
}

func metaFromState(st *game.GameState) SessionMeta {
	head := strings.TrimSpace(st.Overview)
	if i := strings.Index(head, "\n"); i >= 0 {
		head = head[:i]
	}
	if len(head) > 160 {
		head = head[:160] + "..."
	}
	return SessionMeta{
		ID:           st.SessionID,
		Name:         st.Name,
		CreatedAt:    st.CreatedAt,
		LastPlayedAt: st.LastPlayedAt,
		OverviewHead: head,
		StoryChars:   st.TotalContentChars(),
	}
}

func (s *SessionStore) Get(id string) (*game.GameState, error) {
	if id == "" {
		return nil, ErrNotFound
	}
	data, err := os.ReadFile(s.filePath(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("read session: %w", err)
	}
	var st game.GameState
	if err := json.Unmarshal(data, &st); err != nil {
		return nil, fmt.Errorf("unmarshal session: %w", err)
	}
	if st.Migrate() {
		_ = s.writeState(&st)
	}
	if st.SessionID == "" {
		st.SessionID = id
		_ = s.writeState(&st)
	}
	return &st, nil
}

// Save writes the state to the session file. Updates LastPlayedAt.
func (s *SessionStore) Save(id string, st *game.GameState) error {
	if id == "" {
		return ErrNotFound
	}
	st.SessionID = id
	st.LastPlayedAt = time.Now().Unix()
	if st.CreatedAt == 0 {
		st.CreatedAt = st.LastPlayedAt
	}
	st.Migrate()
	return s.writeState(st)
}

func (s *SessionStore) writeState(st *game.GameState) error {
	data, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}
	if err := os.WriteFile(s.filePath(st.SessionID), data, 0644); err != nil {
		return fmt.Errorf("write session: %w", err)
	}
	return nil
}

// Create makes a new session from the seed state (or default if seed is nil).
// Returns the created state with its new SessionID assigned. Does NOT change current.
func (s *SessionStore) Create(name string, seed *game.GameState) (*game.GameState, error) {
	var st game.GameState
	if seed != nil {
		st = *seed
	} else {
		st = *game.DefaultState()
	}
	st.SessionID = newID()
	if strings.TrimSpace(name) != "" {
		st.Name = strings.TrimSpace(name)
	} else if st.Name == "" {
		st.Name = "Adventure"
	}
	now := time.Now().Unix()
	st.CreatedAt = now
	st.LastPlayedAt = now
	st.Migrate()
	if err := s.writeState(&st); err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *SessionStore) Rename(id, name string) error {
	st, err := s.Get(id)
	if err != nil {
		return err
	}
	st.Name = strings.TrimSpace(name)
	if st.Name == "" {
		st.Name = "Adventure"
	}
	return s.writeState(st)
}

func (s *SessionStore) Delete(id string) error {
	err := os.Remove(s.filePath(id))
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete session: %w", err)
	}
	// If deleting current, clear the pointer.
	if cur, _ := s.GetCurrent(); cur == id {
		_ = os.Remove(s.currentPath())
	}
	return nil
}

func (s *SessionStore) GetCurrent() (string, error) {
	data, err := os.ReadFile(s.currentPath())
	if err != nil {
		if os.IsNotExist(err) {
			return "", ErrNoCurrent
		}
		return "", fmt.Errorf("read current: %w", err)
	}
	var p currentPointer
	if err := json.Unmarshal(data, &p); err != nil {
		return "", fmt.Errorf("parse current: %w", err)
	}
	if p.ID == "" {
		return "", ErrNoCurrent
	}
	// Validate session still exists.
	if _, err := os.Stat(s.filePath(p.ID)); os.IsNotExist(err) {
		return "", ErrNoCurrent
	}
	return p.ID, nil
}

func (s *SessionStore) SetCurrent(id string) error {
	if id == "" {
		return os.Remove(s.currentPath())
	}
	if _, err := os.Stat(s.filePath(id)); err != nil {
		return ErrNotFound
	}
	data, err := json.MarshalIndent(currentPointer{ID: id}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.currentPath(), data, 0644)
}

// ClearCurrent removes the current pointer without deleting any session file.
func (s *SessionStore) ClearCurrent() error {
	err := os.Remove(s.currentPath())
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// DeleteAll removes every session file and clears the current pointer.
func (s *SessionStore) DeleteAll() error {
	entries, err := os.ReadDir(s.sessionsPath())
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("read sessions dir: %w", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		_ = os.Remove(filepath.Join(s.sessionsPath(), e.Name()))
	}
	_ = os.Remove(s.currentPath())
	return nil
}

// LoadCurrent loads the state for the current session, or ErrNoCurrent.
func (s *SessionStore) LoadCurrent() (*game.GameState, error) {
	id, err := s.GetCurrent()
	if err != nil {
		return nil, err
	}
	return s.Get(id)
}

// SaveCurrent saves state to the current session file (if one is set).
func (s *SessionStore) SaveCurrent(st *game.GameState) error {
	id, err := s.GetCurrent()
	if err != nil {
		return err
	}
	return s.Save(id, st)
}

// ExportJSON returns a session's state as formatted JSON.
func (s *SessionStore) ExportJSON(id string) ([]byte, error) {
	st, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(st, "", "  ")
}

// ImportJSON creates a new session from JSON bytes.
func (s *SessionStore) ImportJSON(data []byte) (*game.GameState, error) {
	var st game.GameState
	if err := json.Unmarshal(data, &st); err != nil {
		return nil, fmt.Errorf("unmarshal import: %w", err)
	}
	// Always assign a new id on import to avoid collision.
	st.SessionID = newID()
	now := time.Now().Unix()
	if st.CreatedAt == 0 {
		st.CreatedAt = now
	}
	st.LastPlayedAt = now
	st.Migrate()
	if err := s.writeState(&st); err != nil {
		return nil, err
	}
	return &st, nil
}
