export function getAdmissionsNotices(enrollments, assessments) {
  return enrollments.flatMap((enrollment) => {
    if (['completed', 'dropped'].includes(enrollment.status)) return [];
    const matches = assessments.filter((item) => String(item.enrollment_id) === String(enrollment.id));
    const assessment = matches.find((item) => ['recommended', 'needs_followup'].includes(item.status)) || matches[0];
    const base = { id: enrollment.id, program: enrollment.program_title, href: '/contact', label: 'Contact admin' };
    if (assessment && ['recommended', 'needs_followup'].includes(assessment.status)) {
      return [{ ...base, title: assessment.status === 'needs_followup' ? 'Aptitude test follow-up required' : 'Aptitude test pending', detail: assessment.status === 'needs_followup' ? 'Admissions has requested a follow-up. Open your aptitude test to review the feedback and update your answers.' : 'Admissions has recommended an aptitude test for your application. Please complete it to continue your application review.', href: `/student/aptitude/${assessment.id}`, label: 'Open aptitude test' }];
    }
    if (enrollment.status !== 'pending') return [];
    if (assessment?.status === 'submitted') return [{ ...base, title: 'Aptitude test submitted — awaiting review', detail: 'Your answers have been received. Admissions will review your test and confirm the next steps. Contact admin if you need help.' }];
    if (assessment?.status === 'reviewed') return [{ ...base, title: 'Application awaiting admission decision', detail: 'Your aptitude test has been reviewed. Please await confirmation from admissions or contact admin about the next steps.' }];
    return [{ ...base, title: 'Application awaiting review', detail: 'Your application has been submitted. Admissions may recommend an aptitude test; it will appear here when available. Please await instructions or contact admin for the next steps.' }];
  });
}
