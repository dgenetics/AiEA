import { SystemDetail } from "@/components/farm/system-detail";

export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[960px] px-1 pt-1 pb-28 min-[700px]:px-4 min-[700px]:pt-3">
      <SystemDetail id={id} />
    </div>
  );
}
