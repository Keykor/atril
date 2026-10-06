import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getLastOpenedScore, getSetList } from '../core/db/queries';
import { initHints, unmarkHint } from '../core/db/repos';
import { HelpCard, HelpScreen } from '../features/help/HelpScreen';
import { exportAnnotatedPdf } from '../features/annotations/exportPdf';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { TagNav } from '../features/library/TagNav';
import { ListsScreen } from '../features/setlists/ListsScreen';
import { BackupCard, BackupReminder } from '../features/settings/Backup';
import { BackupStatus, DriveCard, useDriveState } from '../features/settings/Drive';
import { InstallBanner, InstallCard } from '../features/settings/Install';
import { VersionCard } from '../features/settings/Update';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { back, navigate, useRoute } from './router';
import { HINTS, LEGACY_HINTS, PlaceHint, type HintId } from './hints';
import { ScoreScreen } from './ScoreScreen';
import { Shell } from './Shell';
import { t } from './strings';

// Pistas que se muestran dentro de una partitura: "Mostrame" abre la última que se abrió.
const IN_SCORE: HintId[] = ['reader', 'annotate', 'markers', 'page', 'practice'];
const PLACE: Partial<Record<HintId, string>> = {
  lists: '/lists',
  library: '/',
  backup: '/settings',
};

export function App() {
  const [section, id, sub] = useRoute();
  const [tagId, setTagId] = useState<string>();
  const drive = useDriveState();
  const footer = <BackupStatus />;
  const lastScore = useLiveQuery(getLastOpenedScore, []);

  useEffect(() => void initHints([...HINTS], LEGACY_HINTS), []);

  const showHint = async (hint: HintId) => {
    if (IN_SCORE.includes(hint) && !lastScore) return;
    await unmarkHint(hint);
    navigate(IN_SCORE.includes(hint) ? `/score/${lastScore!.id}/${hint}` : PLACE[hint]!);
  };

  if (section === 'score' && id)
    return <ScoreScreen key={id} scoreId={id} tour={sub as HintId | undefined} />;
  if (section === 'show' && id) return <ShowRoute listId={id} index={Number(sub ?? 0)} />;
  if (section === 'settings')
    return (
      <Shell section="settings" footer={footer}>
        <SettingsScreen>
          <HelpCard />
          <BackupCard />
          <DriveCard />
          <InstallCard />
          <VersionCard />
        </SettingsScreen>
        <PlaceHint id="backup" />
      </Shell>
    );
  if (section === 'help')
    return (
      <Shell section="settings" footer={footer}>
        <HelpScreen
          hints={HINTS.map((h) => ({ id: h, title: t.hints[h].title }))}
          needsScore={lastScore ? [] : IN_SCORE}
          onShow={(h) => void showHint(h as HintId)}
        />
      </Shell>
    );
  if (section === 'lists')
    return (
      <Shell section="lists" footer={footer}>
        <ListsScreen
          listId={id}
          onSelect={(listId) => navigate(listId ? `/lists/${listId}` : '/lists', !!id)}
          onShow={(listId, index) => navigate(`/show/${listId}/${index}`)}
        />
        <PlaceHint id="lists" />
      </Shell>
    );
  return (
    <Shell
      section="library"
      footer={footer}
      sidebar={<TagNav tagId={tagId} onSelect={setTagId} variant="sidebar" />}
    >
      <LibraryScreen
        tagId={tagId}
        onTag={setTagId}
        onOpen={(sid) => navigate(`/score/${sid}`)}
        onExport={(sid) => exportAnnotatedPdf(sid, t.meta.exportSuffix)}
        banner={
          <>
            <InstallBanner />
            <BackupReminder suppressed={drive?.connected && !drive.error} />
          </>
        }
      />
      <PlaceHint id="library" />
    </Shell>
  );
}

/** Modo show: abre el ítem `index` de una lista. */
function ShowRoute({ listId, index }: { listId: string; index: number }) {
  const list = useLiveQuery(() => getSetList(listId), [listId]);
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
