import { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function ApplicationSubmitted() {
  const { state } = useLocation();
  useEffect(() => { document.title = 'Application Submitted | JT NextGen Tech Hub'; }, []);

  // Only show a receipt after the registration request has succeeded.
  if (!state?.applicationSubmitted) return <Navigate to="/student" replace />;

  return (
    <section className="mx-auto max-w-2xl py-10 sm:py-16" aria-labelledby="application-submitted-title">
      <div className="card space-y-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
        <div>
          <h1 id="application-submitted-title" className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Application submitted successfully</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-300">Thank you for applying to JT NextGen Tech Hub. Your account has been created and your application is awaiting review by admissions.</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-5 text-left dark:bg-brand-900/20">
          <h2 className="font-semibold text-gray-900 dark:text-white">What happens next?</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Admissions will review your application and may recommend an aptitude test. Log in to your dashboard to check your status and take the test when it becomes available.</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">You do not need to submit another application. Contact admin if you need help with the next steps.</p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/student" className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">Go to my dashboard</Link>
          <Link to="/contact" className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Contact admin</Link>
        </div>
      </div>
    </section>
  );
}
