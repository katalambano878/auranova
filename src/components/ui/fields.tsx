import { cn } from "@/lib/utils";

export function Input(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn("w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-stone focus:border-forest", props.className)} />;
}

export function Textarea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn("w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm outline-none placeholder:text-stone focus:border-forest", props.className)} />;
}

export function Label(props: React.ComponentProps<"label">) {
  return <label {...props} className={cn("mb-1.5 block text-sm text-stone", props.className)} />;
}

export function Badge({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "copper" | "moss" | "line" }) {
  const tones = {
    ink: "bg-forest text-white",
    copper: "bg-leaf text-white",
    moss: "bg-sage text-forest",
    line: "bg-mist text-ink",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.14em] ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-mist px-6 py-16 text-center">
      <h2 className="font-serif text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-stone">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
