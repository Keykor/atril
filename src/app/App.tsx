import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../core/db/db';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { TagNav } from '../features/library/TagNav';
import { ListsScreen } from '../features/setlists/ListsScreen';
import { BackupCard, BackupReminder } from '../features/settings/Backup';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { back, navigate, useRoute } from './router';
import { ScoreScreen } from './ScoreScreen';
import { Shell } from './Shell';
import { t } from './strings';

export function App() {
  const [section, id, sub] = useRoute();
  const [tagId, setTagId] = useState<string>();

  if (section === 'score' && id) return <ScoreScreen key={id} scoreId={id} />;
  if (section === 'show' && id) return <ShowRoute listId={id} index={Number(sub ?? 0)} />;
  if (section === 'settings')
    return (
      <Shell section="settings">
        <SettingsScreen>
          <BackupCard />
        </SettingsScreen>
      </Shell>
    );
  if (section === 'lists')
    return (
      <Shell section="lists">
        <ListsScreen
          listId={id}
          onSelect={(listId) => navigate(listId ? `/lists/${listId}` : '/lists', !!id)}
          onShow={(listId, index) => navigate(`/show/${listId}/${index}`)}
        />
      </Shell>
    );
  return (
    <Shell
      section="library"
      sidebar={<TagNav tagId={tagId} onSelect={setTagId} variant="sidebar" />}
    >
      <LibraryScreen
        tagId={tagId}
        onTag={setTagId}
        onOpen={(sid) => navigate(`/score/${sid}`)}
        banner={<BackupReminder />}
      />
    </Shell>
  );
}

/** Modo show: abre el ítem `index` de una lista. */
function ShowRoute({ listId, index }: { listId: string; index: number }) {
  const list = useLiveQuery(() => db.setlists.get(listId).then((l) => l ?? null), [listId]);
  if (list === undefined) return null;
  const item = list?.items[index];
  if (!list || item?.type !== 'score')
    return (
      <div className="score-screen reader-message">
        <p>{t.reader.notFound}</p>
        <button className="btn" onClick={back}>
          {t.lists.backToList}
        </button>
      </div>
    );
  return <ScoreScreen key={item.id} scoreId={item.scoreId} show={{ list, index }} />;
}
