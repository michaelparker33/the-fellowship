import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-serif italic text-muted-foreground mb-4">
          Not all those who wander are lost...
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          but this page is.
        </p>
        <Link
          href="/"
          className="text-sm text-accent hover:underline"
        >
          Return to The Fellowship →
        </Link>
      </div>
    </div>
  );
}
