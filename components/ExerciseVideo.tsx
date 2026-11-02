import { Play, RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';

import appConfig from '@/app.json';
import type { CuratedVideo } from '@/data/youtubeVideos';
import { useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';

/**
 * Optional in-app YouTube tutorial (Master Plan v3 §3.2 rule 5). Nothing is
 * loaded until the user taps play. The official IFrame Player API runs in an
 * OS WebView whose origin is the app's bundle id (YouTube's client identity
 * requirement for embedded players); the page is generated locally, so no
 * third-party host is involved. Links inside the player (YouTube logo, title,
 * "Watch on YouTube") stay working, as YouTube's policies require, but open
 * outside the app (YouTube app or Safari) instead of replacing the player;
 * nothing else may navigate the WebView. Only the video id is stored; the
 * player shows its own title and attribution. Errors and missing connectivity
 * show a fallback card; a workout never depends on it.
 */

type PlayerState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'offline';

/** YouTube's minimum embedded player size is 200×200. */
const MIN_HEIGHT = 200;
const READY_TIMEOUT_MS = 15_000;
export const PLAYER_ORIGIN = `https://${appConfig.expo.ios.bundleIdentifier}`;

/** Player error strings from react-native-youtube-iframe that mean "this video cannot play here". */
const UNPLAYABLE = new Set(['embed_not_allowed', 'video_not_found', 'invalid_parameter', 'HTML5_error']);

const YOUTUBE_HOST = /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be|youtube-nocookie\.com|google\.com)(\/|$)/i;

/**
 * Only the generated player page may load in the top frame; YouTube's iframe
 * loads inside it. A top-frame request to YouTube (a link in the player) is
 * handed to iOS so it opens in the YouTube app or Safari; anything else is
 * dropped.
 */
export function allowPlayerNavigation(
  request: Pick<WebViewNavigation, 'url'> & { isTopFrame?: boolean; mainDocumentURL?: string },
  openExternally: (url: string) => unknown = (url) => Linking.openURL(url).catch(() => undefined),
): boolean {
  if (request.isTopFrame === false) return true;
  const url = request.mainDocumentURL ?? request.url;
  if (url === 'about:blank' || url.startsWith(PLAYER_ORIGIN)) return true;
  if (YOUTUBE_HOST.test(request.url)) openExternally(request.url);
  return false;
}

export function ExerciseVideo({ video }: { video: CuratedVideo | null }) {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const [state, setState] = useState<PlayerState>('idle');
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state !== 'loading') return;
    timeout.current = setTimeout(() => setState('offline'), READY_TIMEOUT_MS);
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [state, attempt]);

  if (!video) {
    return (
      <View style={styles.card}>
        <Text style={styles.note}>{t('ios.video.none')}</Text>
      </View>
    );
  }

  const height = Math.max(MIN_HEIGHT, Math.round((width * 9) / 16));
  const start = () => {
    setAttempt((value) => value + 1);
    setState('loading');
  };

  return (
    <View style={styles.card} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {state === 'idle' ? (
        <Pressable
          onPress={start}
          accessibilityRole="button"
          accessibilityLabel={`${t('ios.video.title')}, YouTube`}
          style={({ pressed }) => [styles.poster, { height }, pressed && styles.pressed]}
        >
          <View style={styles.playButton}>
            <Play size={28} color={theme.colors.onTint} fill={theme.colors.onTint} />
          </View>
        </Pressable>
      ) : state === 'unavailable' || state === 'offline' ? (
        <View style={[styles.poster, styles.fallback, { height }]} accessibilityLiveRegion="polite">
          <Text style={styles.fallbackText}>{state === 'offline' ? t('ios.video.needsInternet') : t('ios.video.unavailable')}</Text>
          <Pressable onPress={start} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <RotateCcw size={16} color={theme.colors.link} />
            <Text style={styles.retryText}>{t('ios.video.retry')}</Text>
          </Pressable>
        </View>
      ) : width > 0 ? (
        <YoutubePlayer
          key={attempt}
          height={height}
          width={width}
          videoId={video.videoId}
          play={false}
          useLocalHTML
          baseUrlOverride={PLAYER_ORIGIN}
          initialPlayerParams={{ rel: false }}
          onReady={() => setState('ready')}
          onError={(error: string) => setState(UNPLAYABLE.has(error) ? 'unavailable' : 'offline')}
          webViewProps={{
            onShouldStartLoadWithRequest: (request: WebViewNavigation) => allowPlayerNavigation(request),
            onError: () => setState('offline'),
            onHttpError: () => setState('offline'),
            allowsFullscreenVideo: true,
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: true,
            setSupportMultipleWindows: false,
            javaScriptCanOpenWindowsAutomatically: false,
          }}
        />
      ) : null}
      <View style={styles.caption}>
        <Text style={styles.title}>{t('ios.video.title')}</Text>
        <Text style={styles.note}>{t('ios.video.source')}</Text>
        {state === 'idle' ? <Text style={styles.note}>{t('ios.video.needsInternet')}</Text> : null}
      </View>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    card: {
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    poster: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceHigh },
    playButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.tint },
    fallback: { gap: t.spacing.md, paddingHorizontal: t.spacing.lg },
    fallbackText: { ...t.typography.subheadline, color: t.colors.labelSecondary, textAlign: 'center' },
    retry: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, minHeight: 44, paddingHorizontal: t.spacing.md },
    retryText: { ...t.typography.headline, color: t.colors.link },
    caption: { padding: t.spacing.lg, gap: t.spacing.xxs },
    title: { ...t.typography.subheadline, color: t.colors.label },
    note: { ...t.typography.footnote, color: t.colors.labelSecondary, padding: 0 },
    pressed: { opacity: 0.7 },
  }),
);
