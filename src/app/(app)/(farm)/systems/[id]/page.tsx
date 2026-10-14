import { SystemDetail } from "@/components/farm/system-detail";

export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[960px]">
      <SystemDetail id={id} />
    </div>
  );
}
