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
 */
export function YouTubeTutorial({
  videoId,
  title,
  description,
}: {
  videoId: string;
  title: string;
  description: string;
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
              {/* eslint-disable-next-line @next/next/no-img-element -- served by YouTube's CDN, not worth an image-optimisation transformation */}
              <img
                src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                alt={title}
                loading="lazy"
                decoding="async"
                width={480}
                height={360}
                className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-saffron text-ink shadow-lg transition group-hover:scale-105 sm:h-20 sm:w-20">
                  <Play className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" />
                </span>
              </span>
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
