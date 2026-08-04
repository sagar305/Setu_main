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
        horizontal ? "flex-col sm:flex-row" : "flex-col"
      }`}
    >
      {/*
        3:2 matches the native ratio of most thumbnails (1536x1024), so the
        image fills the box edge to edge with nothing cropped. `relative`
        positions the fill-mode <Image> inside BlogThumbnail.

        The horizontal layout keeps that ratio rather than stretching the column
        to the row height: these thumbnails carry text, and letting a taller row
        crop them to a square cuts the words off at both edges. `self-start`
        stops flex from stretching the box back out.
      */}
      <Link
        href={url}
        className={`relative block aspect-[3/2] w-full overflow-hidden ${
          horizontal ? "sm:w-64 sm:flex-shrink-0 sm:self-start" : ""
        }`}
      >
        <BlogThumbnail post={post} />
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
          <span>{post.category}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </div>
        <Link href={url}>
          <h2 className="mt-3 text-lg font-bold text-ink transition hover:text-indigo">{post.title}</h2>
        </Link>
        {/* Clamped in a row so the text column stays close to the image height. */}
        <p
          className={`mt-2 flex-1 text-sm leading-relaxed text-muted ${
            horizontal ? "line-clamp-3" : ""
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
