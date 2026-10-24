"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { FadeIn } from "@/components/motion/FadeIn";

/**
 * A setup walkthrough from YouTube, shown as its thumbnail until it is played.
 *
 * The player is only loaded on click: YouTube's embed pulls in close to a
 * megabyte of script, which every visitor would otherwise pay for a video most
 * of them never start. Until then the thumbnail is an ordinary link to the
 * video, so it still works without JavaScript and crawlers can follow it.
 *
 * The thumbnail is our own artwork from /public: YouTube's own is 480px wide
 * and letterboxed, which blurs at this size. `thumbnail` is the full-size
 * image and `thumbnailSmall` a 960px copy for phones. Artwork that already
 * draws a play button turns ours off with `showPlayButton={false}`.
 */
export function YouTubeTutorial({
  videoId,
  title,
  description,
  thumbnail,
  thumbnailSmall,
  showPlayButton = true,
}: {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  thumbnailSmall: string;
  showPlayButton?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6">
      <FadeIn>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
            Video tutorial
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">{description}</p>
        </div>

        <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-muted-line/30 bg-ink shadow-sm">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <a
              href={watchUrl}
              onClick={(event) => {
                event.preventDefault();
                setPlaying(true);
              }}
              aria-label={`Play video: ${title}`}
              className="group relative block h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- already sized webp in /public; no image-optimisation transformation needed */}
              <img
                src={thumbnail}
                srcSet={`${thumbnailSmall} 960w, ${thumbnail} 1672w`}
                sizes="(min-width: 896px) 846px, calc(100vw - 34px)"
                alt={title}
                loading="lazy"
                decoding="async"
                width={1672}
                height={941}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              {showPlayButton && (
                // In the corner rather than the middle, where thumbnail artwork
                // usually puts its headline.
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-saffron px-3 py-1.5 text-xs font-semibold text-ink shadow-lg transition group-hover:scale-105 sm:bottom-5 sm:right-5 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm">
                  <Play className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" aria-hidden="true" />
                  Watch tutorial
                </span>
              )}
            </a>
          )}
        </div>

        <p className="mt-3 text-center text-sm text-muted">
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-indigo hover:underline"
          >
            Watch on YouTube →
          </a>
        </p>
      </FadeIn>
    </section>
  );
}
