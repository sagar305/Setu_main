type ThumbnailPost = {
  title: string;
  category: string;
  thumbnail: string | null;
};

// Deterministic gradient pair per category, so a category always looks the same
// until real thumbnail images are dropped in.
const GRADIENTS = [
  "from-indigo/25 via-indigo/10 to-cream",
  "from-emerald-200/50 via-emerald-100/30 to-cream",
  "from-amber-200/50 via-amber-100/30 to-cream",
  "from-sky-200/50 via-sky-100/30 to-cream",
  "from-rose-200/50 via-rose-100/30 to-cream",
  "from-violet-200/50 via-violet-100/30 to-cream",
];

function gradientFor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function BlogThumbnail({
  post,
  className = "",
}: {
  post: ThumbnailPost;
  className?: string;
}) {
  if (post.thumbnail) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={post.thumbnail}
        alt={post.title}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(
        post.category,
      )} ${className}`}
    >
      <span className="px-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
        {post.category}
      </span>
    </div>
  );
}
