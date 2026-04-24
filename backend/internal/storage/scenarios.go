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
	scenariosDir    = "scenarios"
	scenarioPrefix  = "scn_"
)

var ErrScenarioNotFound = errors.New("scenario not found")

type ScenarioStore struct {
	root string
}

func NewScenarioStore(root string) (*ScenarioStore, error) {
	if err := os.MkdirAll(filepath.Join(root, scenariosDir), 0755); err != nil {
		return nil, fmt.Errorf("create scenarios dir: %w", err)
	}
	return &ScenarioStore{root: root}, nil
}

func (s *ScenarioStore) dir() string { return filepath.Join(s.root, scenariosDir) }

func (s *ScenarioStore) filePath(id string) string {
	return filepath.Join(s.dir(), id+".json")
}

func newScenarioID() string {
	return fmt.Sprintf("%s%d", scenarioPrefix, time.Now().UnixNano()/1e6)
}

func (s *ScenarioStore) List() ([]*game.Scenario, error) {
	entries, err := os.ReadDir(s.dir())
	if err != nil {
		if os.IsNotExist(err) {
			return []*game.Scenario{}, nil
		}
		return nil, err
	}
	out := make([]*game.Scenario, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(e.Name(), ".json")
		sc, err := s.Get(id)
		if err != nil {
			continue
		}
		out = append(out, sc)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt > out[j].UpdatedAt })
	return out, nil
}

func (s *ScenarioStore) Get(id string) (*game.Scenario, error) {
	data, err := os.ReadFile(s.filePath(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrScenarioNotFound
		}
		return nil, err
	}
	var sc game.Scenario
	if err := json.Unmarshal(data, &sc); err != nil {
		return nil, err
	}
	if sc.Lore == nil {
		sc.Lore = []game.LoreEntry{}
	}
	if sc.Secs == nil {
		sc.Secs = []game.Section{}
	}
	if sc.RollVariants == nil {
		sc.RollVariants = []game.RollVariant{}
	}
	if game.NormalizeLoreTags(sc.Lore) {
		_ = s.write(&sc)
	}
	return &sc, nil
}

func (s *ScenarioStore) write(sc *game.Scenario) error {
	data, err := json.MarshalIndent(sc, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(sc.ID), data, 0644)
}

func (s *ScenarioStore) Create(in *game.Scenario) (*game.Scenario, error) {
	sc := *in
	sc.ID = newScenarioID()
	if strings.TrimSpace(sc.Name) == "" {
		sc.Name = "Scenario"
	}
	if sc.Lore == nil {
		sc.Lore = []game.LoreEntry{}
	}
	if sc.Secs == nil {
		sc.Secs = []game.Section{}
	}
	if sc.RollVariants == nil {
		sc.RollVariants = []game.RollVariant{}
	}
	now := time.Now().Unix()
	sc.CreatedAt = now
	sc.UpdatedAt = now
	if err := s.write(&sc); err != nil {
		return nil, err
	}
	return &sc, nil
}

func (s *ScenarioStore) Update(id string, in *game.Scenario) (*game.Scenario, error) {
	existing, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	in.ID = id
	in.CreatedAt = existing.CreatedAt
	in.UpdatedAt = time.Now().Unix()
	if in.Lore == nil {
		in.Lore = []game.LoreEntry{}
	}
	if in.Secs == nil {
		in.Secs = []game.Section{}
	}
	if in.RollVariants == nil {
		in.RollVariants = []game.RollVariant{}
	}
	if err := s.write(in); err != nil {
		return nil, err
	}
	return in, nil
}

func (s *ScenarioStore) Delete(id string) error {
	err := os.Remove(s.filePath(id))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// DeleteAll removes every scenario file.
func (s *ScenarioStore) DeleteAll() error {
	entries, err := os.ReadDir(s.dir())
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		_ = os.Remove(filepath.Join(s.dir(), e.Name()))
	}
	return nil
}

// InstantiateSession builds a fresh GameState from a scenario — copies setup fields,
// leaves story/summaries/sumUpTo at their zero values. The returned state is NOT persisted.
func (s *ScenarioStore) InstantiateSession(scenarioID string) (*game.GameState, error) {
	sc, err := s.Get(scenarioID)
	if err != nil {
		return nil, err
	}
	st := game.DefaultState()
	st.Overview = sc.Overview
	st.CStyle = sc.CStyle
	if sc.Style != "" {
		st.Style = sc.Style
	}
	if sc.Diff != "" {
		st.Diff = sc.Diff
	}
	// Deep-ish copy of slices to avoid aliasing.
	st.Lore = append([]game.LoreEntry{}, sc.Lore...)
	st.Secs = append([]game.Section{}, sc.Secs...)
	st.RollVariants = append([]game.RollVariant{}, sc.RollVariants...)
	return st, nil
}
