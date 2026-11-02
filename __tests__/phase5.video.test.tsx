import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ExerciseVideo, PLAYER_ORIGIN, allowPlayerNavigation } from '@/components/ExerciseVideo';
import { EXERCISES } from '@/data/exercisesData';
import { CURATED_VIDEOS, type CuratedVideo } from '@/data/youtubeVideos';
import { setCurrentLocale } from '@/i18n';

const video: CuratedVideo = { videoId: 'abcdefghijk', title: 'How to bench press', channel: 'Channel', checkedAt: '2026-11-02T00:00:00.000Z' };

async function layout(view: Awaited<ReturnType<typeof render>>) {
  await act(async () => {
    fireEvent(view.root!, 'layout', { nativeEvent: { layout: { width: 360, height: 300 } } });
  });
}

describe('exercise video', () => {
  beforeEach(() => setCurrentLocale('en'));

  it('loads nothing until play is tapped, then embeds from the app origin', async () => {
    const view = await render(<ExerciseVideo video={video} />);
    await layout(view);
    expect(screen.queryByTestId('youtube-player')).toBeNull();
    expect(screen.getByText('Video needs an internet connection. Everything else works offline.')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Video tutorial: How to bench press' })));
    const player = screen.getByTestId('youtube-player');
    expect(player.props).toMatchObject({ videoId: 'abcdefghijk', useLocalHTML: true, baseUrlOverride: PLAYER_ORIGIN, width: 360, height: 203 });
    expect(PLAYER_ORIGIN).toBe('https://com.gymrat.app');
  });

  it('falls back with retry when the video cannot be embedded or the network is down', async () => {
    const view = await render(<ExerciseVideo video={video} />);
    await layout(view);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /Video tutorial/ })));
    await act(async () => screen.getByTestId('youtube-player').props.onError('embed_not_allowed'));
    expect(screen.getByText('This video can’t be played in the app right now.')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Try again' })));
    await act(async () => screen.getByTestId('youtube-player').props.webViewProps.onError());
    expect(screen.getByText('Video needs an internet connection. Everything else works offline.')).toBeTruthy();
  });

  it('keeps the player at YouTube’s 200 pt minimum on narrow layouts', async () => {
    const view = await render(<ExerciseVideo video={video} />);
    await act(async () => fireEvent(view.root!, 'layout', { nativeEvent: { layout: { width: 240, height: 300 } } }));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /Video tutorial/ })));
    expect(screen.getByTestId('youtube-player').props.height).toBe(200);
  });

  it('says so when no video is verified', async () => {
    await render(<ExerciseVideo video={null} />);
    expect(screen.getByText('No tutorial video has been verified for this exercise yet.')).toBeTruthy();
  });

  it('never navigates the player page away (no redirect to YouTube or Safari)', () => {
    expect(allowPlayerNavigation({ url: 'about:blank' })).toBe(true);
    expect(allowPlayerNavigation({ url: `${PLAYER_ORIGIN}/` })).toBe(true);
    expect(allowPlayerNavigation({ url: 'https://www.youtube.com/embed/abcdefghijk', isTopFrame: false })).toBe(true);
    expect(allowPlayerNavigation({ url: 'https://www.youtube.com/watch?v=abcdefghijk', isTopFrame: true })).toBe(false);
    expect(allowPlayerNavigation({ url: 'https://m.youtube.com/', mainDocumentURL: 'https://m.youtube.com/' })).toBe(false);
  });
});

describe('curated video list', () => {
  it('only holds verified entries for built-in exercises', () => {
    for (const [exerciseId, entry] of Object.entries(CURATED_VIDEOS)) {
      expect(EXERCISES[exerciseId as keyof typeof EXERCISES]).toBeDefined();
      expect(entry.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.channel.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(entry.checkedAt))).toBe(false);
      expect(EXERCISES[exerciseId as keyof typeof EXERCISES].videoId).toBe(entry.videoId);
    }
  });
});
