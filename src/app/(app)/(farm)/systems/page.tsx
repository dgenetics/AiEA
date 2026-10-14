import { SystemsList } from "@/components/farm/systems-list";

export default function SystemsPage() {
  return (
    <div className="mx-auto max-w-[960px] px-1 pt-1 pb-28 min-[700px]:px-4 min-[700px]:pt-3 md:px-2 md:pt-2">
      <SystemsList />
    </div>
  );
}
