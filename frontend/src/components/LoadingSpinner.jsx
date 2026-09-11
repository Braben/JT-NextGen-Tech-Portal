/**
 * LoadingSpinner — reusable full-width loading indicator
 *
 * Used as the Suspense fallback for lazy-loaded routes and on any
 * page while data is being fetched.
 */
export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}
