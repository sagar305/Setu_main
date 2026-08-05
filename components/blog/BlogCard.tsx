import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog";
import { getBlogPostUrl } from "@/lib/blog";
import { BlogThumbnail } from "@/components/blog/BlogThumbnail";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * `horizontal` puts the thumbnail beside the text and is meant for full-width
 * listing rows (/blog and the category pages). `vertical` is the original card
 * for narrow grids, like the related-posts strip under an article.
 *
 * Horizontal still stacks below `sm`, where there is no room for two columns.
 */
export function BlogCard({
  post,
  layout = "vertical",
}: {
  post: BlogPostSummary;
  layout?: "vertical" | "horizontal";
}) {
  const url = getBlogPostUrl(post);
  const horizontal = layout === "horizontal";

  return (
    <article
      className={`flex overflow-hidden rounded-2xl border border-muted-line/20 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        horizontal ? "flex-col sm:h-56 sm:flex-row" : "flex-col"
      }`}
    >
      {/*
        3:2 matches the native ratio of the thumbnails, so the image fills its
        box edge to edge with nothing cropped. `relative` positions the
        fill-mode <Image> inside BlogThumbnail.

        In a row the card is a fixed height and the image takes that full
        height, deriving its width from the 3:2 ratio. Every row then lines up
        at the same height with no gap beside the image, and the image is still
        never cropped — which matters because these thumbnails carry text.
      */}
      <Link
        href={url}
        className={`relative block aspect-[3/2] w-full overflow-hidden ${
          horizontal ? "sm:h-full sm:w-auto sm:flex-shrink-0" : ""
        }`}
      >
        <BlogThumbnail post={post} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
          <span>{post.category}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </div>
        <Link href={url}>
          {/* Clamped in a row so a long headline cannot push the fixed height. */}
          <h2
            className={`mt-3 text-lg font-bold text-ink transition hover:text-indigo ${
              horizontal ? "line-clamp-2" : ""
            }`}
          >
            {post.title}
          </h2>
        </Link>
        <p
          className={`mt-2 flex-1 text-sm leading-relaxed text-muted ${
            horizontal ? "line-clamp-2" : ""
          }`}
        >
          {post.excerpt}
        </p>
        <Link href={url} className="mt-4 inline-block text-sm font-semibold text-indigo hover:underline">
          Read more →
        </Link>
      </div>
    </article>
  );
}
