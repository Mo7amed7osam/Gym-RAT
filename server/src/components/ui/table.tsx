import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-[14px]", className)} {...props} />
    </div>
  );
}
export const THead = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn("text-[11px] uppercase tracking-[0.12em] text-fg-muted", className)} {...props} />;
export const TBody = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <tbody className={cn("divide-y divide-border", className)} {...props} />;
export const TR = ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("transition-colors hover:bg-surface-raised/60", className)} {...props} />;
export const TH = ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => <th scope="col" className={cn("px-5 py-3 font-semibold", className)} {...props} />;
export const TD = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-5 py-3.5 align-middle", className)} {...props} />;
