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

export function BlogCard({ post }: { post: BlogPostSummary }) {
  const url = getBlogPostUrl(post);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-muted-line/20 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={url} className="block aspect-[16/9] w-full overflow-hidden">
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
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{post.excerpt}</p>
        <Link href={url} className="mt-4 inline-block text-sm font-semibold text-indigo hover:underline">
          Read more →
        </Link>
      </div>
    </article>
  );
}
