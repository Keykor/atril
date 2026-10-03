import { useState } from 'react';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { TagNav } from '../features/library/TagNav';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { navigate, useRoute } from './router';
import { ScoreScreen } from './ScoreScreen';
import { Shell } from './Shell';

export function App() {
  const [section, id] = useRoute();
  const [tagId, setTagId] = useState<string>();

  if (section === 'score' && id) return <ScoreScreen key={id} scoreId={id} />;
  if (section === 'settings')
    return (
      <Shell section="settings">
        <SettingsScreen />
      </Shell>
    );
  return (
    <Shell
      section="library"
      sidebar={<TagNav tagId={tagId} onSelect={setTagId} variant="sidebar" />}
    >
      <LibraryScreen tagId={tagId} onTag={setTagId} onOpen={(id) => navigate(`/score/${id}`)} />
    </Shell>
  );
}
