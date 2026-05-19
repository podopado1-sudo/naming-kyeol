export function EmptyState() {
  return (
    <div className="mx-auto my-8 max-w-md rounded-2xl border border-paper-line bg-paper-card p-10 text-center shadow-sm">
      <p className="eyebrow mb-3">RESULT · EMPTY</p>
      <h2 className="mb-3 text-2xl font-medium text-navy">
        이번엔 어울리는 이름을 찾지 못했어요
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        조건이 너무 까다로워서 후보가 모두 걸러졌어요.
        <br />한 가지만 살짝 풀어볼까요?
      </p>
    </div>
  );
}
