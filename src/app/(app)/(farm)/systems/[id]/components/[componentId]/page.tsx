import { ComponentDetail } from "@/components/farm/component-detail";

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ id: string; componentId: string }>;
}) {
  const { id, componentId } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <ComponentDetail systemId={id} componentId={componentId} />
    </div>
  );
}
