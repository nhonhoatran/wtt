'use client';

import { useState } from 'react';
import type { PublicVideo } from '@kamito/shared';
import styles from './video-embed.module.css';

function embedUrl(video: PublicVideo): string | null {
  if (video.provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.embedId)}?autoplay=1`;
  if (video.provider === 'facebook') return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(video.url)}&show_text=false&autoplay=true`;
  return null;
}

/** Third-party iframe loads only after the visitor asks to play the video. */
export function VideoEmbedFacade({ video, label }: { video: PublicVideo; label: string }) {
  const [play, setPlay] = useState(false);
  const src = embedUrl(video);
  if (play && src) {
    return (
      <div className={styles.embedWrap}>
        <iframe src={src} title={video.title} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
      </div>
    );
  }
  return (
    <button type="button" className={styles.facade} onClick={() => src && setPlay(true)} aria-label={`${label}: ${video.title}`} disabled={!src}>
      {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className={styles.facadeImage} /> : <span className={styles.facadeImage} />}
      <span className={styles.play}>{label}</span>
    </button>
  );
}
