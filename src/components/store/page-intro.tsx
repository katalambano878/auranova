export function PageIntro({
  eyebrow,
  title,
  body,
  aside,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-xs uppercase tracking-[0.22em] text-leaf">{eyebrow}</p> : null}
        <h1 className="mt-2 font-serif text-5xl text-ink">{title}</h1>
        {body ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone">{body}</p> : null}
      </div>
      {aside}
    </div>
  );
}
