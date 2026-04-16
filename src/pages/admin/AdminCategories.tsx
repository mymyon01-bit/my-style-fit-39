import { useCategories, type Category } from "@/hooks/useCategories";
import { ChevronRight, FolderTree, Loader2 } from "lucide-react";
import { useState } from "react";

const CategoryNode = ({ cat, depth = 0 }: { cat: Category; depth?: number }) => {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = cat.children && cat.children.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex w-full items-center gap-2 py-2.5 px-3 rounded-lg text-left transition-colors hover:bg-foreground/[0.03] ${
          depth === 0 ? "text-foreground/70 font-medium" : "text-foreground/50"
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasChildren && (
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="text-[12px]">{cat.name}</span>
        <span className="text-[10px] text-foreground/30 ml-auto">{cat.slug}</span>
      </button>
      {open && hasChildren && (
        <div>
          {cat.children!.map(child => (
            <CategoryNode key={child.id} cat={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const AdminCategories = () => {
  const { tree, loading } = useCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">Categories</h1>
        <span className="text-[11px] text-foreground/40">Manage via database</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-4 w-4 animate-spin text-foreground/40" /></div>
      ) : tree.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <FolderTree className="mx-auto h-8 w-8 text-foreground/20" />
          <p className="text-[13px] text-foreground/50">No categories found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/20 bg-card/30 divide-y divide-border/10">
          {tree.map(cat => (
            <CategoryNode key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
