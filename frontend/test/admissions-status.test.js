import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdmissionsNotices } from '../src/utils/admissionsStatus.js';

const enrollment = { id: 'e1', program_title: 'Computing', status: 'pending' };
const assessment = (status) => ({ id: 'a1', enrollment_id: 'e1', status });

test('new applicants await review without being told a test is already available', () => {
  const [notice] = getAdmissionsNotices([enrollment], []);
  assert.equal(notice.title, 'Application awaiting review');
  assert.equal(notice.href, '/contact');
});
test('recommended and follow-up tests link to the matching assessment', () => {
  for (const status of ['recommended', 'needs_followup']) {
    const [notice] = getAdmissionsNotices([enrollment], [assessment(status)]);
    assert.equal(notice.href, '/student/aptitude/a1');
    assert.equal(notice.label, 'Open aptitude test');
  }
});
test('submitted and reviewed tests await review or the admission decision', () => {
  assert.match(getAdmissionsNotices([enrollment], [assessment('submitted')])[0].title, /submitted.*awaiting review/);
  assert.match(getAdmissionsNotices([enrollment], [assessment('reviewed')])[0].title, /admission decision/);
});
test('approved, completed and dropped applications do not keep a pending notice', () => {
  for (const status of ['active', 'completed', 'dropped']) {
    assert.deepEqual(getAdmissionsNotices([{ ...enrollment, status }], [assessment('reviewed')]), []);
  }
});
test('multiple applications use their own assessment and active follow-ups remain actionable', () => {
  const notices = getAdmissionsNotices([enrollment, { id: 'e2', status: 'active' }], [{ ...assessment('recommended'), enrollment_id: 'e2' }]);
  assert.equal(notices[0].href, '/contact');
  assert.equal(notices[1].href, '/student/aptitude/a1');
  assert.deepEqual(getAdmissionsNotices([{ ...enrollment, status: 'dropped' }], [assessment('recommended')]), []);
});
