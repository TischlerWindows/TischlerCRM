/** Phase 2B: Clean full-viewport container — no dashboard nav, no sidebar */
export default function PageEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100">
      {children}
    </div>
  );
}
