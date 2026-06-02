# Frontend Standards

## Components

**Shadcn UI components** → `app/components/ui/`
**Custom components** → `app/components/` (flat — no deeper nesting)

## Styling

Use `cn()` from `~/lib/utils` to combine Tailwind classes (clsx + tailwind-merge):
```ts
import { cn } from "~/lib/utils";
className={cn("base-class", condition && "conditional-class")}
```

## Prices

Always use `formatPrice()` from `~/lib/utils` — handles "Free" for 0/null values. Never format manually.
